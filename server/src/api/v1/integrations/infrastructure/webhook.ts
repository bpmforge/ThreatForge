/**
 * Infrastructure Change Webhook
 *
 * Accepts webhooks from Terraform Cloud, AWS Config, or K8s admission
 * controllers when infrastructure changes are detected. Marks affected
 * threats as NEEDS_REVIEW so security teams can re-assess.
 *
 * Endpoint: POST /api/v1/organizations/<orgId>/integrations/infrastructure/webhook
 * Every delivery must carry `X-Hub-Signature-256: sha256=<hex>` — HMAC-SHA256
 * of the JSON body keyed with the organization's webhook secret (an admin
 * generates it with POST /api/ci/webhook-secret?organizationId=<orgId>).
 * Only that organization's threat models are scanned. Terraform Cloud (which
 * signs with HMAC-SHA512) and AWS SNS cannot produce this header natively, so
 * they need a relay that re-signs the body.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../../db.js";
import { verifyOrgWebhookDelivery } from "../../../ci/helpers.js";
import { sendSuccess, sendBadRequest } from "../../../../utils/api-response.js";
import logger from "../../../../utils/logger.js";

/** Infrastructure change payload (normalized across providers) */
interface InfraChangeEvent {
  provider: "terraform-cloud" | "aws-config" | "k8s" | "generic";
  resourceType?: string;
  resourceName?: string;
  changeType?: "CREATE" | "UPDATE" | "DELETE" | "DRIFT";
  workspace?: string;
  region?: string;
  metadata?: Record<string, unknown>;
}

/** Normalize AWS Config event */
function normalizeAwsConfig(body: Record<string, unknown>): InfraChangeEvent {
  return {
    provider: "aws-config",
    resourceType: String(body.resourceType ?? ""),
    resourceName: String(body.resourceId ?? body.resourceName ?? ""),
    changeType:
      body.configurationItemStatus === "ResourceDeleted" ? "DELETE" : "UPDATE",
    region: String(body.awsRegion ?? ""),
  };
}

/** Normalize Terraform Cloud event */
function normalizeTerraformCloud(
  body: Record<string, unknown>,
): InfraChangeEvent {
  const data = (body.data ?? {}) as Record<string, unknown>;
  const attrs = (data.attributes ?? {}) as Record<string, unknown>;
  return {
    provider: "terraform-cloud",
    workspace: String(attrs["workspace-name"] ?? ""),
    changeType: attrs.status === "applied" ? "UPDATE" : "DRIFT",
    resourceType: "terraform-workspace",
    resourceName: String(attrs["workspace-name"] ?? ""),
  };
}

/** Match a resource change to components in a threat model by technology tag */
async function findAffectedComponents(
  prisma: Awaited<ReturnType<typeof getPrisma>>,
  orgId: string,
  event: InfraChangeEvent,
): Promise<
  Array<{ threatModelId: string; componentId: string; componentName: string }>
> {
  const affected: Array<{
    threatModelId: string;
    componentId: string;
    componentName: string;
  }> = [];

  if (!event.resourceType && !event.resourceName) return affected;

  // Find this org's threat models whose canvas contains matching components
  const models = await prisma.threatModel.findMany({
    where: { deletedAt: null, project: { organizationId: orgId } },
    select: { id: true, canvasState: true },
  });

  const searchTerms = [
    event.resourceType?.toLowerCase(),
    event.resourceName?.toLowerCase(),
    event.workspace?.toLowerCase(),
  ].filter(Boolean) as string[];

  for (const model of models) {
    let canvas: {
      nodes?: Array<{
        id: string;
        data?: {
          label?: string;
          name?: string;
          technology?: string;
          type?: string;
        };
      }>;
    } = {};
    try {
      canvas = JSON.parse(String(model.canvasState ?? "{}"));
    } catch {
      continue;
    }

    for (const node of canvas.nodes ?? []) {
      const nodeText = [
        node.data?.label,
        node.data?.name,
        node.data?.technology,
        node.data?.type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (searchTerms.some((term) => nodeText.includes(term))) {
        affected.push({
          threatModelId: model.id,
          componentId: node.id,
          componentName: node.data?.label ?? node.data?.name ?? node.id,
        });
      }
    }
  }

  return affected;
}

export const infrastructureWebhookRoutes: FastifyPluginAsync = async (
  server,
) => {
  const prisma = await getPrisma();

  /**
   * POST /organizations/:orgId/integrations/infrastructure/webhook
   * Receive infrastructure change events and mark affected threats for review.
   */
  server.post<{ Params: { orgId: string }; Body: Record<string, unknown> }>(
    "/organizations/:orgId/integrations/infrastructure/webhook",
    {
      schema: {
        tags: ["Infrastructure Integration"],
        summary:
          "Receive infrastructure change webhook and flag affected threats",
      },
      // No user session: authenticated by the org's HMAC signature below
      config: {
        skipAuth: true,
        authz: { public: "HMAC-signed with the org webhook secret" },
      },
    },
    async (request, reply) => {
      const { orgId } = request.params;

      if (
        !(await verifyOrgWebhookDelivery(
          request,
          reply,
          orgId,
          "sign deliveries with it",
        ))
      ) {
        return reply;
      }

      const body = request.body ?? {};

      // Detect provider from payload shape
      let event: InfraChangeEvent;
      if (body.configurationItem || body.resourceType) {
        event = normalizeAwsConfig(body);
      } else if (
        body.data &&
        (body.data as Record<string, unknown>).type === "runs"
      ) {
        event = normalizeTerraformCloud(body);
      } else {
        // Generic format: { resourceType, resourceName, changeType }
        event = {
          provider: "generic",
          resourceType: String(body.resourceType ?? ""),
          resourceName: String(body.resourceName ?? ""),
          changeType:
            (body.changeType as InfraChangeEvent["changeType"]) ?? "UPDATE",
        };
      }

      if (!event.resourceType && !event.resourceName && !event.workspace) {
        return sendBadRequest(
          reply,
          "Could not identify resource from webhook payload",
        );
      }

      logger.info({ orgId, event }, "Infrastructure change webhook received");

      // Find affected components
      const affected = await findAffectedComponents(prisma, orgId, event);

      if (affected.length === 0) {
        return sendSuccess(reply, {
          processed: true,
          affectedThreats: 0,
          message: "No matching components found in threat models",
        });
      }

      // Mark threats on affected components as NEEDS_REVIEW
      const threatModelIds = [...new Set(affected.map((a) => a.threatModelId))];
      const componentIds = affected.map((a) => a.componentId);

      const threats = await prisma.threat.findMany({
        where: {
          threatModelId: { in: threatModelIds },
          componentNodeId: { in: componentIds },
          status: { notIn: ["MITIGATED", "ACCEPTED", "NOT_APPLICABLE"] },
        },
      });

      let flagged = 0;
      for (const threat of threats) {
        await prisma.threat.update({
          where: { id: threat.id },
          data: {
            reviewStatus: "PENDING",
            updatedAt: new Date(),
          },
        });
        flagged++;
      }

      logger.info(
        { event, affectedComponents: affected.length, threatsFlag: flagged },
        "Infrastructure webhook processed",
      );

      return sendSuccess(reply, {
        processed: true,
        provider: event.provider,
        resource:
          `${event.resourceType ?? ""} ${event.resourceName ?? ""}`.trim(),
        affectedComponents: affected.length,
        affectedThreats: flagged,
      });
    },
  );
};
