/**
 * Webhook delivery routes
 *
 * Test delivery and event listing.
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import crypto from "crypto";
import { getPrisma } from "../../../db.js";
import { loadManagedWebhook } from "./helpers.js";
import { decryptValue } from "../../../services/encryption/encryption-service.js";
import { sendBadRequest } from "../../../utils/api-response.js";
import { getAuthUser } from "../../../utils/auth-helpers.js";
import { assertPublicHttpUrl } from "../../../utils/outbound-url.js";
import { WEBHOOK_EVENTS, getEventDescription } from "../index.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const ORG_ADMIN = routeAuthz({ org: "ADMIN" });
const AUTHENTICATED = routeAuthz("authenticated");

export const webhookDeliveryRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /api/organizations/:organizationId/webhooks/:webhookId/test
   * Send a test webhook delivery
   */
  server.post<{ Params: { organizationId: string; webhookId: string } }>(
    "/api/organizations/:organizationId/webhooks/:webhookId/test",
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
        "Only admins and owners can test webhooks",
      );
      if (!webhook) return reply;

      const prisma = await getPrisma();

      // URLs saved before the public-host check existed may still be internal
      const urlError = await assertPublicHttpUrl(webhook.url);
      if (urlError) {
        return sendBadRequest(reply, urlError);
      }

      // Build test payload
      const testPayload = {
        event: "test",
        timestamp: new Date().toISOString(),
        organizationId,
        data: {
          message: "This is a test webhook delivery from ThreatForge",
          webhookId,
          webhookName: webhook.name,
        },
      };

      // Generate signature if secret exists
      let signature: string | undefined;
      if (webhook.secret) {
        const decryptedSecret = decryptValue(webhook.secret);
        if (decryptedSecret) {
          const payload = JSON.stringify(testPayload);
          signature = crypto
            .createHmac("sha256", decryptedSecret)
            .update(payload)
            .digest("hex");
        }
      }

      // Send test request
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Webhook-Event": "test",
        "X-Webhook-Delivery": crypto.randomUUID(),
      };

      if (signature) {
        headers["X-Webhook-Signature"] = `sha256=${signature}`;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(webhook.url, {
          method: "POST",
          headers,
          body: JSON.stringify(testPayload),
          signal: controller.signal,
          redirect: "manual",
        });

        clearTimeout(timeoutId);

        // Only the status code is reported: echoing the body would turn this
        // endpoint into a reader for whatever the URL points at.
        const success = response.ok;
        const statusCode = response.status;
        await response.body?.cancel().catch(() => undefined);

        // Update webhook status
        await prisma.webhook.update({
          where: { id: webhookId },
          data: {
            lastTriggeredAt: new Date(),
            ...(success
              ? {
                  lastSuccessAt: new Date(),
                  consecutiveFailures: 0,
                }
              : {
                  lastFailureAt: new Date(),
                  lastFailureReason: `HTTP ${statusCode}`,
                  consecutiveFailures: { increment: 1 },
                }),
            totalDeliveries: { increment: 1 },
            ...(success
              ? { successfulDeliveries: { increment: 1 } }
              : { failedDeliveries: { increment: 1 } }),
          },
        });

        return {
          success,
          statusCode,
          message: success
            ? "Test delivery successful"
            : `Delivery failed: HTTP ${statusCode}`,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        // Update failure stats
        await prisma.webhook.update({
          where: { id: webhookId },
          data: {
            lastTriggeredAt: new Date(),
            lastFailureAt: new Date(),
            lastFailureReason: errorMessage,
            consecutiveFailures: { increment: 1 },
            totalDeliveries: { increment: 1 },
            failedDeliveries: { increment: 1 },
          },
        });

        return {
          success: false,
          statusCode: null,
          message: `Delivery failed: ${errorMessage}`,
        };
      }
    },
  );

  /**
   * GET /api/webhooks/events
   * Get list of available webhook events
   */
  server.get("/api/webhooks/events", AUTHENTICATED, async () => {
    return {
      events: WEBHOOK_EVENTS.map((event) => {
        const [resource, action] = event.split(".");
        return {
          event,
          resource,
          action,
          description: getEventDescription(event),
        };
      }),
    };
  });
};
