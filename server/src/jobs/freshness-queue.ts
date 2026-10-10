import logger from "../utils/logger.js";
/**
 * Freshness Check Queue
 *
 * Daily BullMQ job that finds stale threat models and sends in-app +
 * email notifications to org members who can access them.
 *
 * Runs at 09:00 UTC every day when Redis is available.
 * Deduplicates: skips models already notified within the last 7 days.
 */

const QUEUE_NAME = "freshness-checks";
const DEDUPE_WINDOW_DAYS = 7;
const DAILY_CRON = "0 9 * * *";

let _queue: import("bullmq").Queue | null = null;

/**
 * Initialize the freshness check queue and its daily repeating job.
 * Call once during server startup when Redis is available.
 */
export async function initFreshnessQueue(redisUrl: string): Promise<void> {
  const { Queue, Worker } = await import("bullmq");
  const connection = { url: redisUrl };

  _queue = new Queue(QUEUE_NAME, { connection });

  // Schedule daily freshness check (idempotent — BullMQ deduplicates by jobId)
  await _queue.add(
    "daily-check",
    {},
    {
      jobId: "freshness-daily-check",
      repeat: { pattern: DAILY_CRON },
      removeOnComplete: { age: 86_400 },
      removeOnFail: { age: 7 * 86_400 },
    },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      await runFreshnessCheck();
      // Enqueue scheduled / change-triggered re-analysis for opted-in models.
      const { runScheduledReanalysis } = await import(
        "../services/freshness/scheduled-reanalysis.js"
      );
      await runScheduledReanalysis();
    },
    { connection, concurrency: 1 },
  );

  worker.on("completed", () => {
    logger.info("[freshness] Daily check completed");
  });
  worker.on("failed", (_job, err) => {
    logger.error({ err }, "[freshness] Daily check failed");
  });
}

/**
 * Core logic: find stale models, resolve recipients, send notifications.
 * Can also be called directly (e.g., in tests or admin triggers); an admin
 * trigger passes its organizationId so it never touches other tenants.
 */
export async function runFreshnessCheck(
  options: { organizationId?: string } = {},
): Promise<{
  notified: number;
  skipped: number;
}> {
  const { findStaleModels } = await import(
    "../services/freshness/freshness-check.js"
  );
  const { NotificationService } = await import(
    "../services/notifications/notification-service.js"
  );
  const { getPrisma } = await import("../db.js");

  const prisma = await getPrisma();
  const ns = new NotificationService();
  const staleModels = await findStaleModels(options);

  let notified = 0;
  let skipped = 0;
  const dedupeWindow = new Date(Date.now() - DEDUPE_WINDOW_DAYS * 86_400_000);

  for (const model of staleModels) {
    // Dedup: skip if we already sent a freshness alert for this model recently
    const recent = await prisma.notification.count({
      where: {
        type: "MODEL_STALE",
        link: { contains: model.id },
        createdAt: { gte: dedupeWindow },
      },
    });
    if (recent > 0) {
      skipped++;
      continue;
    }

    // Find users who have access to this model's org
    const members = await prisma.membership.findMany({
      where: { organizationId: model.organizationId, status: "ACTIVE" },
      select: { userId: true },
    });
    if (members.length === 0) {
      skipped++;
      continue;
    }

    const priority = model.staleness === "critical" ? "HIGH" : "NORMAL";
    const days = model.daysSinceUpdate;

    await ns.notify({
      type: "MODEL_STALE",
      category: "MODEL",
      priority,
      recipientIds: members.map((m) => m.userId),
      link: `/models/${model.id}`,
      data: {
        modelName: model.name,
        projectName: model.projectName,
        daysSinceUpdate: days,
        staleness: model.staleness,
        openThreatCount: model.openThreatCount,
      },
    });

    notified++;
  }

  return { notified, skipped };
}
