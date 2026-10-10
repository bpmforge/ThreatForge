/**
 * Webhook Dispatcher Service
 *
 * Fires webhook events to all subscribed endpoints for an organization.
 * Each attempt creates a WebhookDelivery record. On failure, scheduling
 * a retry is delegated to the webhook-retry-queue (no inline retry loops).
 */
import crypto from "crypto";
import { getPrisma } from "../../db.js";
import { decryptValue } from "../encryption/encryption-service.js";
import { WEBHOOK_EVENTS, type WebhookEvent } from "../../api/webhooks.js";
import logger from "../../utils/logger.js";
import { assertPublicHttpUrl } from "../../utils/outbound-url.js";

/**
 * `sha256=<hex>` HMAC of `body` with the webhook's stored (encrypted) secret;
 * null when the webhook has no secret. Throws when the secret cannot be
 * decrypted: a delivery must never go out unsigned, or with any part of the
 * secret, in that case.
 */
export function signWebhookBody(
  encryptedSecret: string | null,
  body: string,
): string | null {
  if (!encryptedSecret) return null;
  const secret = decryptValue(encryptedSecret);
  if (!secret) {
    throw new Error("Webhook secret could not be decrypted; delivery not sent");
  }
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

/**
 * POST a webhook body to a tenant-supplied URL: refuses private/internal
 * hosts and never follows redirects (a public host cannot bounce it inward).
 */
export async function postToWebhookUrl(
  url: string,
  init: { headers: Record<string, string>; body: string; signal?: AbortSignal },
): Promise<Response> {
  const urlError = await assertPublicHttpUrl(url);
  if (urlError) throw new Error(`Webhook URL rejected: ${urlError}`);
  return fetch(url, { method: "POST", redirect: "manual", ...init });
}

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  organizationId: string;
  data: Record<string, unknown>;
}

interface DeliveryResult {
  webhookId: string;
  deliveryId: string;
  success: boolean;
  statusCode: number | null;
  error?: string;
}

/**
 * Dispatch a webhook event to all active subscribers.
 * Fire-and-forget — delivery failures don't affect the caller.
 */
export async function dispatchWebhookEvent(
  organizationId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  if (!WEBHOOK_EVENTS.includes(event)) {
    logger.warn({ event }, "Unknown webhook event");
    return;
  }

  // Fire and forget
  deliverToSubscribers(organizationId, event, data).catch((err) => {
    logger.error({ err, event }, "Webhook dispatch error");
  });
}

async function deliverToSubscribers(
  organizationId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<DeliveryResult[]> {
  const prisma = await getPrisma();

  const webhooks = await prisma.webhook.findMany({
    where: { organizationId, isActive: true },
  });

  const subscribedWebhooks = webhooks.filter((webhook) => {
    const events = JSON.parse(webhook.events) as string[];
    return events.includes(event) || events.includes("*");
  });

  if (subscribedWebhooks.length === 0) return [];

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    organizationId,
    data,
  };

  const results = await Promise.all(
    subscribedWebhooks.map((webhook) => deliverPayload(webhook, payload)),
  );

  return results;
}

/**
 * Attempt a single delivery. Creates a WebhookDelivery row.
 * On failure, schedules a retry via the webhook-retry-queue.
 *
 * `attempt` = the attempt number being made now (1-based).
 * Callers pass attempt=1 for the initial dispatch.
 */
export async function deliverPayload(
  webhook: {
    id: string;
    url: string;
    secret: string | null;
    maxRetries: number;
  },
  payload: WebhookPayload,
  attempt = 1,
): Promise<DeliveryResult> {
  const prisma = await getPrisma();
  const payloadString = JSON.stringify(payload);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Event": payload.event,
    "X-Webhook-Timestamp": payload.timestamp,
    "X-Webhook-ID": crypto.randomUUID(),
  };

  // Create delivery record (PENDING → updated below)
  const delivery = await prisma.webhookDelivery.create({
    data: {
      webhookId: webhook.id,
      event: payload.event,
      requestBody: payloadString.slice(0, 10_000),
      retryCount: attempt - 1,
      status: "PENDING",
    },
  });

  try {
    const signature = signWebhookBody(webhook.secret, payloadString);
    if (signature) headers["X-Webhook-Signature"] = signature;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const response = await postToWebhookUrl(webhook.url, {
      headers,
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const success = response.ok;
    const statusCode = response.status;
    const responseText = await response.text().catch(() => "");

    // Update delivery record
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        statusCode,
        responseBody: responseText.slice(0, 1_000),
        status: success ? "DELIVERED" : "FAILED",
        deliveredAt: success ? new Date() : null,
      },
    });

    // Update webhook aggregate stats
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        lastTriggeredAt: new Date(),
        ...(success
          ? { lastSuccessAt: new Date(), consecutiveFailures: 0 }
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

    if (!success) {
      // Schedule retry via queue (max 3 total retries after initial attempt)
      const maxRetries = webhook.maxRetries || 3;
      if (attempt <= maxRetries) {
        await scheduleRetry(delivery.id, attempt);
      } else {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { status: "PERMANENTLY_FAILED" },
        });
        logger.warn(
          { webhookId: webhook.id, deliveryId: delivery.id },
          "Webhook delivery permanently failed — max retries exhausted",
        );
      }
    }

    return {
      webhookId: webhook.id,
      deliveryId: delivery.id,
      success,
      statusCode,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: "FAILED", errorMessage },
    });

    await prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        lastTriggeredAt: new Date(),
        lastFailureAt: new Date(),
        lastFailureReason: errorMessage,
        consecutiveFailures: { increment: 1 },
        totalDeliveries: { increment: 1 },
        failedDeliveries: { increment: 1 },
      },
    });

    // Schedule retry
    const maxRetries = webhook.maxRetries || 3;
    if (attempt <= maxRetries) {
      await scheduleRetry(delivery.id, attempt);
    } else {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: "PERMANENTLY_FAILED" },
      });
    }

    return {
      webhookId: webhook.id,
      deliveryId: delivery.id,
      success: false,
      statusCode: null,
      error: errorMessage,
    };
  }
}

/**
 * Schedule a retry for a failed delivery.
 * `attempt` = the attempt that just failed (1-based).
 * Next attempt will be attempt+1 with delay based on attempt number.
 */
async function scheduleRetry(
  deliveryId: string,
  attempt: number,
): Promise<void> {
  try {
    const { scheduleWebhookRetry } = await import(
      "../../jobs/webhook-retry-queue.js"
    );
    await scheduleWebhookRetry(deliveryId, attempt + 1);
  } catch {
    // Queue not initialized (no Redis) — log and move on
    logger.warn(
      { deliveryId, attempt },
      "Webhook retry queue unavailable; retry skipped",
    );
  }
}
