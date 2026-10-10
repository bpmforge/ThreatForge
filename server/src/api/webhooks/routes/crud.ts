/**
 * Webhook CRUD routes
 *
 * Create, list, update, and delete webhooks for an organization.
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { getPrisma } from "../../../db.js";
import { loadManagedWebhook } from "./helpers.js";
import { checkOrganizationAccess } from "../../../services/access-control/access-control-service.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";
import { logAudit } from "../../../services/audit.js";
import { encryptValue } from "../../../services/encryption/encryption-service.js";
import {
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
  sendInternalError,
} from "../../../utils/api-response.js";
import { getAuthUser } from "../../../utils/auth-helpers.js";
import { assertPublicHttpUrl } from "../../../utils/outbound-url.js";
import { WEBHOOK_EVENTS, type WebhookEvent } from "../index.js";

interface CreateWebhookBody {
  name: string;
  url: string;
  events: string[];
  secret?: string;
}

interface UpdateWebhookBody {
  name?: string;
  url?: string;
  events?: string[];
  secret?: string;
  isActive?: boolean;
}

const ORG_ADMIN = routeAuthz({ org: "ADMIN" });

export const webhookCrudRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/organizations/:organizationId/webhooks
   * List all webhooks for an organization
   */
  server.get<{ Params: { organizationId: string } }>(
    "/api/organizations/:organizationId/webhooks",
    ORG_ADMIN,
    async (
      request: FastifyRequest<{ Params: { organizationId: string } }>,
      reply: FastifyReply,
    ) => {
      const user = getAuthUser(request);

      const { organizationId } = request.params;

      // Check access - only admins/owners can manage webhooks
      const access = await checkOrganizationAccess(user.id, organizationId);
      if (!access.hasAccess) {
        return sendNotFound(reply, "Organization");
      }

      if (!access.permissions.includes("manage")) {
        return sendForbidden(
          reply,
          "Only admins and owners can manage webhooks",
        );
      }

      const prisma = await getPrisma();

      const webhooks = await prisma.webhook.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
      });

      return webhooks.map((webhook) => ({
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: JSON.parse(webhook.events),
        isActive: webhook.isActive,
        hasSecret: !!webhook.secret,
        maxRetries: webhook.maxRetries,
        lastTriggeredAt: webhook.lastTriggeredAt,
        lastSuccessAt: webhook.lastSuccessAt,
        lastFailureAt: webhook.lastFailureAt,
        lastFailureReason: webhook.lastFailureReason,
        consecutiveFailures: webhook.consecutiveFailures,
        totalDeliveries: webhook.totalDeliveries,
        successfulDeliveries: webhook.successfulDeliveries,
        failedDeliveries: webhook.failedDeliveries,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
      }));
    },
  );

  /**
   * POST /api/organizations/:organizationId/webhooks
   * Create a new webhook
   */
  server.post<{ Params: { organizationId: string }; Body: CreateWebhookBody }>(
    "/api/organizations/:organizationId/webhooks",
    ORG_ADMIN,
    async (
      request: FastifyRequest<{
        Params: { organizationId: string };
        Body: CreateWebhookBody;
      }>,
      reply: FastifyReply,
    ) => {
      const user = getAuthUser(request);

      const { organizationId } = request.params;
      const { name, url, events, secret } = request.body;

      // Validate input
      if (!name || !url || !events || events.length === 0) {
        return sendBadRequest(
          reply,
          "Name, URL, and at least one event are required",
        );
      }

      const urlError = await assertPublicHttpUrl(url);
      if (urlError) {
        return sendBadRequest(reply, urlError);
      }

      // Validate events
      const invalidEvents = events.filter(
        (e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent),
      );
      if (invalidEvents.length > 0) {
        return sendBadRequest(
          reply,
          `Invalid events: ${invalidEvents.join(", ")}`,
        );
      }

      // Check access
      const access = await checkOrganizationAccess(user.id, organizationId);
      if (!access.hasAccess) {
        return sendNotFound(reply, "Organization");
      }

      if (!access.permissions.includes("manage")) {
        return sendForbidden(
          reply,
          "Only admins and owners can create webhooks",
        );
      }

      const prisma = await getPrisma();

      // Check webhook limit (max 10 per org)
      const existingCount = await prisma.webhook.count({
        where: { organizationId },
      });
      if (existingCount >= 10) {
        return sendBadRequest(reply, "Maximum of 10 webhooks per organization");
      }

      // Encrypt secret if provided
      let encryptedSecret: string | null = null;
      if (secret) {
        encryptedSecret = encryptValue(secret);
        if (!encryptedSecret) {
          return sendInternalError(reply, "Failed to encrypt webhook secret");
        }
      }

      const webhook = await prisma.webhook.create({
        data: {
          organizationId,
          name,
          url,
          events: JSON.stringify(events),
          secret: encryptedSecret,
          createdById: user.id,
        },
      });

      // Audit log
      await logAudit({
        scope: "ORGANIZATION",
        action: "CREATE",
        resourceType: "SYSTEM_SETTINGS",
        resourceId: webhook.id,
        resourceName: `Webhook: ${name}`,
        userId: user.id,
        userEmail: user.email || "unknown",
        organizationId,
        metadata: { events, url: url.substring(0, 50) },
      });

      return sendCreated(reply, {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: JSON.parse(webhook.events),
        isActive: webhook.isActive,
        hasSecret: !!webhook.secret,
        createdAt: webhook.createdAt,
      });
    },
  );

  /**
   * PATCH /api/organizations/:organizationId/webhooks/:webhookId
   * Update a webhook
   */
  server.patch<{
    Params: { organizationId: string; webhookId: string };
    Body: UpdateWebhookBody;
  }>(
    "/api/organizations/:organizationId/webhooks/:webhookId",
    ORG_ADMIN,
    async (
      request: FastifyRequest<{
        Params: { organizationId: string; webhookId: string };
        Body: UpdateWebhookBody;
      }>,
      reply: FastifyReply,
    ) => {
      const user = getAuthUser(request);

      const { organizationId, webhookId } = request.params;
      const { name, url, events, secret, isActive } = request.body;

      const webhook = await loadManagedWebhook(
        reply,
        user.id,
        organizationId,
        webhookId,
        "Only admins and owners can update webhooks",
      );
      if (!webhook) return reply;

      const prisma = await getPrisma();

      // Validate URL if provided
      if (url) {
        const urlError = await assertPublicHttpUrl(url);
        if (urlError) {
          return sendBadRequest(reply, urlError);
        }
      }

      // Validate events if provided
      if (events) {
        const invalidEvents = events.filter(
          (e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent),
        );
        if (invalidEvents.length > 0) {
          return sendBadRequest(
            reply,
            `Invalid events: ${invalidEvents.join(", ")}`,
          );
        }
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (url !== undefined) updateData.url = url;
      if (events !== undefined) updateData.events = JSON.stringify(events);
      if (isActive !== undefined) updateData.isActive = isActive;

      // Handle secret update
      if (secret !== undefined) {
        if (secret === "") {
          updateData.secret = null;
        } else {
          const encryptedSecret = encryptValue(secret);
          if (!encryptedSecret) {
            return sendInternalError(reply, "Failed to encrypt webhook secret");
          }
          updateData.secret = encryptedSecret;
        }
      }

      const updated = await prisma.webhook.update({
        where: { id: webhookId },
        data: updateData,
      });

      // Audit log
      await logAudit({
        scope: "ORGANIZATION",
        action: "UPDATE",
        resourceType: "SYSTEM_SETTINGS",
        resourceId: webhookId,
        resourceName: `Webhook: ${updated.name}`,
        userId: user.id,
        userEmail: user.email || "unknown",
        organizationId,
        metadata: { updatedFields: Object.keys(updateData) },
      });

      return {
        id: updated.id,
        name: updated.name,
        url: updated.url,
        events: JSON.parse(updated.events),
        isActive: updated.isActive,
        hasSecret: !!updated.secret,
        updatedAt: updated.updatedAt,
      };
    },
  );

  /**
   * DELETE /api/organizations/:organizationId/webhooks/:webhookId
   * Delete a webhook
   */
  server.delete<{ Params: { organizationId: string; webhookId: string } }>(
    "/api/organizations/:organizationId/webhooks/:webhookId",
    ORG_ADMIN,
    async (
      request: FastifyRequest<{
        Params: { organizationId: string; webhookId: string };
      }>,
      reply: FastifyReply,
    ) => {
      const user = getAuthUser(request);

      const { organizationId, webhookId } = request.params;

      const webhook = await loadManagedWebhook(
        reply,
        user.id,
        organizationId,
        webhookId,
        "Only admins and owners can delete webhooks",
      );
      if (!webhook) return reply;

      const prisma = await getPrisma();

      await prisma.webhook.delete({ where: { id: webhookId } });

      // Audit log
      await logAudit({
        scope: "ORGANIZATION",
        action: "DELETE",
        resourceType: "SYSTEM_SETTINGS",
        resourceId: webhookId,
        resourceName: `Webhook: ${webhook.name}`,
        userId: user.id,
        userEmail: user.email || "unknown",
        organizationId,
      });

      return { success: true };
    },
  );
};
