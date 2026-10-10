/**
 * Webhook Retry Queue
 *
 * BullMQ worker that re-attempts failed webhook deliveries with
 * exponential back-off: attempt 2→60s, attempt 3→600s, attempt 4→3600s.
 *
 * `attempt` in job data is the attempt number being made (1-based).
 * The initial dispatch is attempt=1; retries are 2, 3, 4.
 * Max supported: 4 total attempts (1 initial + 3 retries).
 */
import logger from "../utils/logger.js";

const QUEUE_NAME = "webhook-retry";

// Delay in ms before each retry attempt (index = attempt being made)
// attempt 2 → 60s, attempt 3 → 600s, attempt 4 → 3600s
const RETRY_DELAYS_MS: Record<number, number> = {
  2: 60_000,
  3: 600_000,
  4: 3_600_000,
};

interface WebhookRetryJobData {
  deliveryId: string;
  webhookId: string;
  attempt: number; // attempt number being made (2, 3, or 4)
}

let _queue: import("bullmq").Queue<WebhookRetryJobData> | null = null;

/**
 * Initialize the webhook retry queue and worker.
 * Call once during server startup when Redis is available.
 */
export async function initWebhookRetryQueue(redisUrl: string): Promise<void> {
  const { Queue, Worker } = await import("bullmq");
  const connection = { url: redisUrl };

  _queue = new Queue<WebhookRetryJobData>(QUEUE_NAME, { connection });

  const worker = new Worker<WebhookRetryJobData>(
    QUEUE_NAME,
    async (job) => processRetry(job.data),
    { connection, concurrency: 2 },
  );

  worker.on("completed", (job) => {
    logger.info(
      { deliveryId: job.data.deliveryId, attempt: job.data.attempt },
      "[webhook-retry] Delivery attempt completed",
    );
  });
  worker.on("failed", (job, err) => {
    logger.error(
      { err, deliveryId: job?.data.deliveryId },
      "[webhook-retry] Worker error",
    );
  });
}

/**
 * Schedule a retry for a delivery. Called from the dispatcher after failure.
 * `attempt` = the attempt number to make next (2, 3, or 4).
 */
export async function scheduleWebhookRetry(
  deliveryId: string,
  attempt: number,
): Promise<void> {
  if (!_queue) {
    logger.warn({ deliveryId }, "webhook-retry queue not initialized");
    return;
  }

  const delay = RETRY_DELAYS_MS[attempt];
  if (delay === undefined) {
    // Beyond max retries — mark permanently failed
    await markPermanentlyFailed(deliveryId);
    return;
  }

  const prisma = await (await import("../db.js")).getPrisma();
  const nextRetryAt = new Date(Date.now() + delay);

  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: { status: "RETRYING", nextRetryAt, retryCount: attempt - 1 },
  });

  const webhook = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    select: { webhookId: true },
  });

  await _queue.add(
    "retry",
    { deliveryId, webhookId: webhook?.webhookId ?? "", attempt },
    {
      delay,
      attempts: 1,
      removeOnComplete: { age: 86_400 },
      removeOnFail: { age: 7 * 86_400 },
    },
  );

  logger.info(
    { deliveryId, attempt, delayMs: delay },
    "[webhook-retry] Retry scheduled",
  );
}

async function processRetry(data: WebhookRetryJobData): Promise<void> {
  const prisma = await (await import("../db.js")).getPrisma();

  // Load delivery with webhook details
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: data.deliveryId },
    include: {
      webhook: {
        select: { id: true, url: true, secret: true, maxRetries: true },
      },
    },
  });

  if (!delivery) {
    logger.warn(
      { deliveryId: data.deliveryId },
      "[webhook-retry] Delivery not found",
    );
    return;
  }

  if (!delivery.requestBody) {
    logger.warn(
      { deliveryId: data.deliveryId },
      "[webhook-retry] No requestBody to replay",
    );
    await markPermanentlyFailed(data.deliveryId);
    return;
  }

  // Parse original payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(delivery.requestBody) as Record<string, unknown>;
  } catch {
    logger.error(
      { deliveryId: data.deliveryId },
      "[webhook-retry] Cannot parse requestBody",
    );
    await markPermanentlyFailed(data.deliveryId);
    return;
  }

  const { deliverPayload } = await import(
    "../services/webhooks/webhook-dispatcher.js"
  );

  const result = await deliverPayload(
    delivery.webhook,
    // The payload type matches WebhookPayload — cast via unknown
    payload as unknown as Parameters<typeof deliverPayload>[1],
    data.attempt,
  );

  if (!result.success) {
    logger.warn(
      {
        deliveryId: data.deliveryId,
        attempt: data.attempt,
        statusCode: result.statusCode,
      },
      "[webhook-retry] Retry attempt failed",
    );
  }
}

async function markPermanentlyFailed(deliveryId: string): Promise<void> {
  const prisma = await (await import("../db.js")).getPrisma();
  await prisma.webhookDelivery
    .update({
      where: { id: deliveryId },
      data: { status: "PERMANENTLY_FAILED", nextRetryAt: null },
    })
    .catch(() => {});
  logger.warn(
    { deliveryId },
    "[webhook-retry] Delivery marked PERMANENTLY_FAILED",
  );
}
