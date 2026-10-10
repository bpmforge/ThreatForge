/**
 * Shared helpers for webhook routes
 */
import type { FastifyReply } from "fastify";
import { getPrisma } from "../../../db.js";
import { checkOrganizationAccess } from "../../../services/access-control/access-control-service.js";
import { sendNotFound, sendForbidden } from "../../../utils/api-response.js";

/**
 * Verify the user can manage the organization and load the webhook.
 * Sends the error response itself and returns null when the request must stop.
 */
export async function loadManagedWebhook(
  reply: FastifyReply,
  userId: string,
  organizationId: string,
  webhookId: string,
  forbiddenMessage: string,
) {
  const access = await checkOrganizationAccess(userId, organizationId);
  if (!access.hasAccess) {
    sendNotFound(reply, "Organization");
    return null;
  }

  if (!access.permissions.includes("manage")) {
    sendForbidden(reply, forbiddenMessage);
    return null;
  }

  const prisma = await getPrisma();

  const webhook = await prisma.webhook.findFirst({
    where: { id: webhookId, organizationId },
  });

  if (!webhook) {
    sendNotFound(reply, "Webhook");
    return null;
  }

  return webhook;
}
