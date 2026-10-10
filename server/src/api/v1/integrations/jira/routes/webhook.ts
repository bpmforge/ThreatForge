/**
 * JIRA Integration - Webhook Routes
 *
 * Handles inbound Jira webhooks so that closing a Jira issue automatically
 * updates the linked ThreatForge mitigation/threat status.
 *
 * Setup in Jira: System → WebHooks → Create a WebHook:
 *   URL:    https://<your-instance>/api/v1/organizations/<orgId>/integrations/jira/webhook
 *   Secret: the organization's webhook secret (an admin generates it with
 *           POST /api/ci/webhook-secret?organizationId=<orgId>)
 *   Events: issue_updated, issue_created, issue_deleted
 *
 * Jira signs each delivery with HMAC-SHA256 of the body in `X-Hub-Signature`
 * (`sha256=<hex>`). Unsigned or mis-signed deliveries are rejected.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../../../db.js";
import { verifyOrgWebhookDelivery } from "../../../../ci/helpers.js";
import {
  sendSuccess,
  sendBadRequest,
  sendNotFound,
} from "../../../../../utils/api-response.js";
import logger from "../../../../../utils/logger.js";

/** Jira "Done" status categories that map to COMPLETED/MITIGATED */
const DONE_CATEGORIES = new Set(["Done", "done", "DONE"]);
const IN_PROGRESS_CATEGORIES = new Set([
  "In Progress",
  "in progress",
  "IN_PROGRESS",
  "In-Progress",
]);

function mapJiraStatusToMitigationStatus(
  jiraStatusCategory: string,
): "NOT_IMPLEMENTED" | "IMPLEMENTED" | null {
  if (DONE_CATEGORIES.has(jiraStatusCategory)) return "IMPLEMENTED";
  if (IN_PROGRESS_CATEGORIES.has(jiraStatusCategory)) return "NOT_IMPLEMENTED";
  return null;
}

function mapJiraStatusToThreatStatus(
  jiraStatusCategory: string,
): "MITIGATED" | null {
  if (DONE_CATEGORIES.has(jiraStatusCategory)) return "MITIGATED";
  return null;
}

export const webhookRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * POST /webhook
   * Receives Jira webhook events and syncs status back to ThreatForge.
   */
  server.post<{
    Params: { orgId: string };
    Body: {
      webhookEvent?: string;
      issue?: {
        id?: string;
        key?: string;
        fields?: {
          status?: {
            name?: string;
            statusCategory?: { name?: string; key?: string };
          };
          summary?: string;
        };
      };
    };
  }>(
    "/webhook",
    {
      schema: {
        tags: ["JIRA Integration"],
        summary: "Receive Jira webhook and sync status to ThreatForge",
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
          "set it as the Jira webhook secret",
        ))
      ) {
        return reply;
      }

      const { webhookEvent, issue } = request.body ?? {};

      if (!issue?.key) {
        return sendBadRequest(reply, "Invalid Jira webhook payload");
      }

      const jiraIssueKey = issue.key;
      const statusCategory =
        issue.fields?.status?.statusCategory?.name ??
        issue.fields?.status?.name ??
        "";

      logger.info(
        { orgId, webhookEvent, jiraIssueKey, statusCategory },
        "Received Jira webhook",
      );

      // Only process status changes
      if (
        webhookEvent !== "jira:issue_updated" &&
        webhookEvent !== "jira:issue_created"
      ) {
        return sendSuccess(reply, {
          processed: false,
          reason: "Event type ignored",
        });
      }

      const integration = await prisma.integration.findFirst({
        where: { organizationId: orgId, type: "JIRA" },
        select: { id: true },
      });
      if (!integration) {
        return sendNotFound(reply, "JIRA integration");
      }

      // Issue keys are only unique per Jira site, so the lookup must stay
      // inside this org's integration.
      const mapping = await prisma.integrationMapping.findFirst({
        where: { integrationId: integration.id, externalId: jiraIssueKey },
      });

      if (!mapping) {
        logger.debug({ jiraIssueKey }, "No mapping found for Jira issue");
        return sendSuccess(reply, {
          processed: false,
          reason: "No mapping found",
        });
      }

      const updated: string[] = [];

      // Handle mitigation mapping
      if (mapping.localType === "mitigation") {
        const newStatus = mapJiraStatusToMitigationStatus(statusCategory);
        if (newStatus) {
          const existing = await prisma.mitigation.findUnique({
            where: { id: mapping.localId },
          });
          if (existing && existing.status !== newStatus) {
            await prisma.mitigation.update({
              where: { id: mapping.localId },
              data: { status: newStatus, updatedAt: new Date() },
            });
            await prisma.integrationMapping.update({
              where: { id: mapping.id },
              data: { lastSyncedAt: new Date() },
            });
            updated.push(
              `Mitigation ${mapping.localId}: ${existing.status} → ${newStatus}`,
            );
            logger.info(
              { mitigationId: mapping.localId, newStatus },
              "Mitigation status updated via Jira webhook",
            );
          }
        }
      }

      // Handle threat mapping
      if (mapping.localType === "threat") {
        const newStatus = mapJiraStatusToThreatStatus(statusCategory);
        if (newStatus) {
          const existing = await prisma.threat.findUnique({
            where: { id: mapping.localId },
          });
          if (existing && existing.status !== newStatus) {
            await prisma.threat.update({
              where: { id: mapping.localId },
              data: { status: newStatus, updatedAt: new Date() },
            });
            await prisma.integrationMapping.update({
              where: { id: mapping.id },
              data: { lastSyncedAt: new Date() },
            });
            updated.push(
              `Threat ${mapping.localId}: ${existing.status} → ${newStatus}`,
            );
            logger.info(
              { threatId: mapping.localId, newStatus },
              "Threat status updated via Jira webhook",
            );
          }
        }
      }

      return sendSuccess(reply, {
        processed: true,
        jiraIssueKey,
        updated,
      });
    },
  );
};
