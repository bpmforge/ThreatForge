/**
 * Outbound webhook delivery.
 *
 * Resolves active webhooks for an organization, filters by subscribed event
 * type, signs the payload when a secret is configured, POSTs, and records
 * per-webhook delivery stats.
 */
import { getPrisma } from "../../db.js";
import {
  postToWebhookUrl,
  signWebhookBody,
} from "../webhooks/webhook-dispatcher.js";
import type {
  NotificationEventPayload,
  NotificationDeliveryResult,
} from "./types.js";

/** Send webhook notification */
export async function sendWebhook(
  data: Record<string, unknown>,
  payload: NotificationEventPayload,
): Promise<NotificationDeliveryResult> {
  if (!payload.organizationId) {
    return {
      channel: "WEBHOOK",
      success: false,
      error: "No organization context",
      timestamp: new Date(),
    };
  }

  const prisma = await getPrisma();

  // Get active webhooks for this organization
  const webhooks = await prisma.webhook.findMany({
    where: {
      organizationId: payload.organizationId,
      isActive: true,
    },
  });

  if (webhooks.length === 0) {
    return {
      channel: "WEBHOOK",
      success: true,
      timestamp: new Date(),
    };
  }

  // Send to all matching webhooks
  const results = await Promise.allSettled(
    webhooks
      .filter((wh) => {
        const events = JSON.parse(wh.events) as string[];
        return events.includes(payload.type) || events.includes("*");
      })
      .map((webhook) => sendToWebhook(webhook, data, payload)),
  );

  const successful = results.filter((r) => r.status === "fulfilled").length;

  return {
    channel: "WEBHOOK",
    success: successful > 0,
    timestamp: new Date(),
  };
}

/** Send to a single webhook */
async function sendToWebhook(
  webhook: { id: string; url: string; secret: string | null },
  data: Record<string, unknown>,
  payload: NotificationEventPayload,
): Promise<void> {
  const prisma = await getPrisma();
  const body = JSON.stringify({
    event: payload.type,
    timestamp: new Date().toISOString(),
    data,
  });

  // Create signature if secret is configured
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const signature = signWebhookBody(webhook.secret, body);
    if (signature) headers["X-Signature-256"] = signature;

    const response = await postToWebhookUrl(webhook.url, { headers, body });

    await prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        lastTriggeredAt: new Date(),
        lastSuccessAt: response.ok ? new Date() : undefined,
        lastFailureAt: response.ok ? undefined : new Date(),
        lastFailureReason: response.ok ? undefined : `HTTP ${response.status}`,
        consecutiveFailures: response.ok ? 0 : { increment: 1 },
        totalDeliveries: { increment: 1 },
        successfulDeliveries: response.ok ? { increment: 1 } : undefined,
        failedDeliveries: response.ok ? undefined : { increment: 1 },
      },
    });
  } catch (error) {
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        lastTriggeredAt: new Date(),
        lastFailureAt: new Date(),
        lastFailureReason:
          error instanceof Error ? error.message : "Unknown error",
        consecutiveFailures: { increment: 1 },
        totalDeliveries: { increment: 1 },
        failedDeliveries: { increment: 1 },
      },
    });
    throw error;
  }
}
