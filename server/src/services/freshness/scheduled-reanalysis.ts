/**
 * Scheduled / change-triggered re-analysis (#60, G7, G1).
 *
 * Run from the daily freshness worker. For each model with a re-analysis
 * schedule, enqueues a SUGGEST_THREATS job when due:
 *   - "weekly":    lastReanalysisAt is null or older than 7 days
 *   - "on-change": the canvas hash differs from the last analyzed hash
 *
 * Re-running the analysis also re-runs OSV CVE enrichment, so new published
 * CVEs against the model's dependencies surface on the weekly cadence.
 *
 * Honors the per-model SUGGEST_THREATS mutex (skips if one is already running)
 * and the org AI spend cap (enqueueAiJob enforces it).
 */
import { createHash } from "node:crypto";
import logger from "../../utils/logger.js";

const WEEKLY_MS = 7 * 24 * 60 * 60 * 1000;

function canvasHash(canvasState: string): string {
  return createHash("sha256").update(canvasState).digest("hex");
}

export async function runScheduledReanalysis(): Promise<{
  enqueued: number;
  skipped: number;
}> {
  const { getPrisma } = await import("../../db.js");
  const { createSuggestThreatsJob } = await import(
    "../../jobs/create-suggest-threats-job.js"
  );
  const { enqueueAiJob } = await import("../../jobs/ai-queue.js");

  const prisma = await getPrisma();

  const models = await prisma.threatModel.findMany({
    where: {
      deletedAt: null,
      reanalysisSchedule: { in: ["weekly", "on-change"] },
    },
    select: {
      id: true,
      canvasState: true,
      createdById: true,
      reanalysisSchedule: true,
      lastReanalysisAt: true,
      reanalysisHash: true,
      project: { select: { organizationId: true } },
    },
  });

  let enqueued = 0;
  let skipped = 0;
  const now = Date.now();

  for (const model of models) {
    const orgId = model.project?.organizationId;
    if (!orgId) {
      skipped++;
      continue;
    }

    const hash = canvasHash(model.canvasState);
    const due =
      model.reanalysisSchedule === "weekly"
        ? !model.lastReanalysisAt ||
          now - model.lastReanalysisAt.getTime() >= WEEKLY_MS
        : hash !== model.reanalysisHash; // on-change

    if (!due) {
      skipped++;
      continue;
    }

    try {
      const result = await createSuggestThreatsJob({
        prisma,
        userId: model.createdById,
        organizationId: orgId,
        threatModelId: model.id,
        input: JSON.stringify({ modelId: model.id }),
      });
      if (result.conflict || !result.job) {
        skipped++;
        continue;
      }
      await enqueueAiJob({
        type: "SUGGEST_THREATS",
        userId: model.createdById,
        organizationId: orgId,
        threatModelId: model.id,
        input: JSON.stringify({ modelId: model.id }),
        dbJobId: result.job.id,
      });
      await prisma.threatModel.update({
        where: { id: model.id },
        data: { lastReanalysisAt: new Date(), reanalysisHash: hash },
      });
      enqueued++;
    } catch (err) {
      // Spend cap, AI not configured, or transient failure — skip this model,
      // don't let one failure abort the whole sweep.
      logger.warn(
        { err, modelId: model.id },
        "[reanalysis] skipped model (enqueue failed)",
      );
      skipped++;
    }
  }

  logger.info({ enqueued, skipped }, "[reanalysis] scheduled sweep complete");
  return { enqueued, skipped };
}
