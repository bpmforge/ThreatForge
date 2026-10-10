/**
 * CI/CD API - Webhook Secret Management Routes
 */
import type { FastifyPluginAsync } from "fastify";
import { randomBytes } from "crypto";
import { getPrisma } from "../../../db.js";
import {
  isOrgAdmin,
  isOrgMember,
  getAuthUser,
  sealCiWebhookSecret,
} from "../helpers.js";
import {
  sendSuccess,
  sendCreated,
  sendForbidden,
} from "../../../utils/api-response.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const ORG_VIEWER = routeAuthz({ org: "VIEWER" });
const ORG_ADMIN = routeAuthz({ org: "ADMIN" });

export const webhookSecretRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/ci/webhook-secret
   * Generate or regenerate CI webhook secret for an organization
   */
  fastify.post<{ Querystring: { organizationId: string } }>(
    "/api/ci/webhook-secret",
    routeAuthz({ org: "ADMIN" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { organizationId } = request.query;
      const prisma = await getPrisma();

      if (!(await isOrgAdmin(user.id, organizationId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const secret = randomBytes(32).toString("hex");

      await prisma.organization.update({
        where: { id: organizationId },
        data: { ciWebhookSecret: sealCiWebhookSecret(secret) },
      });

      return sendCreated(reply, {
        secret,
        webhookUrl: `${process.env.APP_URL || "http://localhost:3001"}/api/ci/webhooks/github/${organizationId}`,
        message:
          "Save this secret securely and configure it in your GitHub webhook settings. " +
          "It cannot be retrieved again.",
      });
    },
  );

  /**
   * GET /api/ci/webhook-secret
   * Check if webhook secret is configured (does not return the actual secret)
   */
  fastify.get<{ Querystring: { organizationId: string } }>(
    "/api/ci/webhook-secret",
    ORG_VIEWER,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { organizationId } = request.query;
      const prisma = await getPrisma();

      if (!(await isOrgMember(user.id, organizationId))) {
        return sendForbidden(reply, "Access denied");
      }

      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { ciWebhookSecret: true },
      });

      return sendSuccess(reply, {
        isConfigured: !!org?.ciWebhookSecret,
        webhookUrl: `${process.env.APP_URL || "http://localhost:3001"}/api/ci/webhooks/github/${organizationId}`,
      });
    },
  );

  /**
   * DELETE /api/ci/webhook-secret
   * Remove CI webhook secret for an organization
   */
  fastify.delete<{ Querystring: { organizationId: string } }>(
    "/api/ci/webhook-secret",
    ORG_ADMIN,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { organizationId } = request.query;
      const prisma = await getPrisma();

      if (!(await isOrgAdmin(user.id, organizationId))) {
        return sendForbidden(reply, "Admin access required");
      }

      await prisma.organization.update({
        where: { id: organizationId },
        data: { ciWebhookSecret: null },
      });

      return sendSuccess(reply, {
        success: true,
        message: "Webhook secret removed",
      });
    },
  );
};
