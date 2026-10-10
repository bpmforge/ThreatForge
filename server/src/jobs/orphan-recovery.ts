/**
 * Orphaned AI Job Recovery
 *
 * Called at server startup to recover jobs left in PROCESSING state from a
 * prior crash, SIGKILL, or pod restart. Two passes:
 *
 *  1. STALE (>30 min old) — mark FAILED; they're zombies.
 *  2. FRESH (<30 min old) — re-enqueue from checkpoint so users see continuity.
 *
 * Also runs a startup sweep: deletes AI_SUGGESTED PENDING threats that were
 * written by sessions now marked FAILED or CANCELLED (safety net for cases
 * where the in-process cleanup hook never ran due to OOM/power-loss).
 */
import { getPrisma } from "../db.js";
import logger from "../utils/logger.js";

const STALE_JOB_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export async function recoverOrphanedJobs(redisUrl?: string): Promise<void> {
  const prisma = await getPrisma();

  const orphaned = await prisma.aiJob.findMany({
    where: { status: "PROCESSING" },
    select: {
      id: true,
      type: true,
      userId: true,
      organizationId: true,
      threatModelId: true,
      input: true,
      checkpoint: true,
      startedAt: true,
    },
  });

  const now = Date.now();
  const staleCutoff = now - STALE_JOB_THRESHOLD_MS;
  const fresh = orphaned.filter(
    (j) => !j.startedAt || j.startedAt.getTime() >= staleCutoff,
  );
  const stale = orphaned.filter(
    (j) => j.startedAt && j.startedAt.getTime() < staleCutoff,
  );

  if (stale.length > 0) {
    logger.info(
      `Marking ${stale.length} stale PROCESSING job(s) as FAILED (older than 30 min)`,
    );
    await prisma.aiJob.updateMany({
      where: { id: { in: stale.map((j) => j.id) } },
      data: {
        status: "FAILED",
        error:
          "Recovery skipped — job stale (>30min old). Start a fresh analysis.",
        completedAt: new Date(),
        progressMessage: "Stale job — recovery skipped",
      },
    });
  }

  // Safety net: delete partial-write threats from FAILED/CANCELLED sessions
  const deadSessions = await prisma.aiJob.findMany({
    where: {
      status: { in: ["FAILED", "CANCELLED"] },
      type: "SUGGEST_THREATS",
    },
    select: { id: true },
  });
  if (deadSessions.length > 0) {
    const swept = await prisma.threat.deleteMany({
      where: {
        analysisSessionId: { in: deadSessions.map((j) => j.id) },
        source: "AI_SUGGESTED",
        reviewStatus: "PENDING",
        manuallyEdited: false,
      },
    });
    if (swept.count > 0) {
      logger.info(
        `Startup sweep: deleted ${swept.count} partial-write threat(s) from failed/cancelled sessions`,
      );
    }
  }

  if (fresh.length === 0) return;

  logger.info(
    `Found ${fresh.length} orphaned PROCESSING job(s) — auto-requeuing...`,
  );

  const { enqueueAiJob, runJobInBackground } = await import("./ai-queue.js");

  for (const job of fresh) {
    let checkpointProgress = 0;
    if (job.checkpoint && job.threatModelId) {
      try {
        const ckpt = JSON.parse(job.checkpoint) as {
          completedComponentIds?: string[];
        };
        const doneCount = ckpt.completedComponentIds?.length ?? 0;
        if (doneCount > 0) {
          const total = await prisma.component.count({
            where: { threatModelId: job.threatModelId },
          });
          if (total > 0)
            checkpointProgress = Math.round((doneCount / total) * 100);
        }
      } catch {
        // best-effort — leave progress at 0
      }
    }

    await prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status: "QUEUED",
        error: null,
        startedAt: null,
        completedAt: null,
        progress: checkpointProgress,
        progressMessage: job.checkpoint
          ? `Auto-requeued after server restart — resuming from checkpoint (${checkpointProgress}% done)`
          : "Auto-requeued after server restart — starting fresh",
      },
    });

    const jobData = {
      type: job.type as import("./ai-queue.js").AiJobType,
      userId: job.userId,
      organizationId: job.organizationId ?? "",
      threatModelId: job.threatModelId ?? undefined,
      input: job.input,
      dbJobId: job.id,
    };

    if (redisUrl) {
      await enqueueAiJob(jobData).catch(() => runJobInBackground(jobData));
    } else {
      runJobInBackground(jobData);
    }
  }

  logger.info(
    `Auto-requeued ${fresh.length} orphaned job(s) from prior restart`,
  );
}
