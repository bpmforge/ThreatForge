/**
 * GitHub Integration - Webhook Route
 */
import { signedBody } from "../../../../../utils/raw-body.js";
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../../../db.js";
import type { GitHubConfig } from "../schemas.js";
import { decryptAndParse } from "../helpers.js";
import {
  verifyGitHubSignature,
  getOrgCiWebhookSecret,
} from "../../../../ci/helpers.js";
import {
  sendSuccess,
  sendNotFound,
  sendForbidden,
  sendUnauthorized,
} from "../../../../../utils/api-response.js";

export const webhookRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /** POST /webhook - GitHub webhook endpoint */
  server.post<{ Params: { orgId: string }; Body: unknown }>(
    "/webhook",
    {
      config: {
        skipAuth: true,
        authz: { public: "HMAC-signed with the org webhook secret" },
      },
    },
    async (request, reply) => {
      const { orgId } = request.params;
      const event = request.headers["x-github-event"] as string;
      const signature = request.headers["x-hub-signature-256"] as string;

      // Verify webhook signature using org's ciWebhookSecret
      const secret = await getOrgCiWebhookSecret(orgId);
      if (!secret) {
        return sendForbidden(
          reply,
          "Webhook secret not configured for this organization",
        );
      }

      if (!verifyGitHubSignature(signedBody(request), signature, secret)) {
        return sendUnauthorized(reply, "Invalid webhook signature");
      }

      const payload = request.body as {
        action?: string;
        issue?: { number: number; state: string; state_reason: string | null };
      };

      if (event !== "issues" || !payload.issue) {
        return sendSuccess(reply, { message: "Event ignored" });
      }

      const integration = await prisma.integration.findFirst({
        where: {
          organizationId: orgId,
          type: "GITHUB_ISSUES",
          status: "ACTIVE",
        },
      });

      if (!integration) return sendNotFound(reply, "Integration");

      const config = decryptAndParse<GitHubConfig>(integration.config);
      if (!config || config.syncDirection === "PUSH_ONLY") {
        return sendSuccess(reply, {
          message: "Webhook received, but pull sync disabled",
        });
      }

      const mapping = await prisma.integrationMapping.findFirst({
        where: {
          integrationId: integration.id,
          externalKey: `#${payload.issue.number}`,
        },
      });

      if (!mapping) return sendSuccess(reply, { message: "Issue not mapped" });

      const isClosed = payload.issue.state === "closed";
      const reason = payload.issue.state_reason;

      type ThreatStatusType =
        | "OPEN"
        | "MITIGATED"
        | "ACCEPTED"
        | "NOT_APPLICABLE";
      const localThreatStatus: ThreatStatusType = isClosed
        ? reason === "not_planned"
          ? "ACCEPTED"
          : "MITIGATED"
        : "OPEN";

      if (mapping.localType === "threat") {
        await prisma.threat.update({
          where: { id: mapping.localId },
          data: { status: localThreatStatus, updatedAt: new Date() },
        });
      } else if (mapping.localType === "mitigation") {
        type MitigationStatusType = "NOT_IMPLEMENTED" | "IMPLEMENTED";
        const mitigationStatus: MitigationStatusType = isClosed
          ? "IMPLEMENTED"
          : "NOT_IMPLEMENTED";
        await prisma.mitigation.update({
          where: { id: mapping.localId },
          data: { status: mitigationStatus, updatedAt: new Date() },
        });
      }

      await prisma.integrationMapping.update({
        where: { id: mapping.id },
        data: { lastSyncedAt: new Date() },
      });

      await prisma.integrationSyncLog.create({
        data: {
          integrationId: integration.id,
          direction: "PULL_ONLY",
          status: "COMPLETED",
          itemsSynced: 1,
          completedAt: new Date(),
          details: JSON.stringify({
            webhook: event,
            action: payload.action,
            issueNumber: payload.issue.number,
          }),
        },
      });

      return sendSuccess(reply, {
        success: true,
        message: "Webhook processed",
      });
    },
  );
};
