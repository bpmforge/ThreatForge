/**
 * Helper for creating SUGGEST_THREATS jobs with mutex enforcement.
 *
 * A partial unique index on ai_jobs (defined in migrations/add-threat-dedup.sql)
 * guarantees at most one QUEUED or PROCESSING SUGGEST_THREATS job per threat
 * model. A concurrent INSERT raises SQLSTATE 23505 which Prisma surfaces as
 * code P2002. This helper catches it and returns a structured conflict result
 * the route can render as 409 Conflict.
 *
 * Every SUGGEST_THREATS enqueue in the codebase should go through this helper
 * so the 409 path is uniform and no call site can accidentally bypass the
 * mutex check.
 */
import { assertWithinSpendCap } from "../services/ai/spend-guard.js";
import type { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";

export interface CreateSuggestThreatsResult {
  conflict: boolean;
  job?: { id: string; threatModelId: string | null };
  existingJobId?: string;
}

interface CreateArgs {
  prisma: PrismaClient;
  userId: string;
  organizationId: string;
  threatModelId: string;
  input: string;
}

/**
 * Insert a SUGGEST_THREATS aiJob row, honoring the per-model mutex.
 *
 * Returns `{ conflict: true, existingJobId }` if another SUGGEST_THREATS
 * job is already QUEUED or PROCESSING for this threat model. Callers
 * should render this as HTTP 409 Conflict.
 */
export async function createSuggestThreatsJob(
  args: CreateArgs,
): Promise<CreateSuggestThreatsResult> {
  const { prisma, userId, organizationId, threatModelId, input } = args;

  // Quota check before any row is created (throws SpendCapExceededError → 429).
  await assertWithinSpendCap(prisma, organizationId);

  try {
    const job = await prisma.aiJob.create({
      data: {
        userId,
        organizationId,
        type: "SUGGEST_THREATS",
        threatModelId,
        input,
      },
      select: { id: true, threatModelId: true },
    });
    return { conflict: false, job };
  } catch (err: unknown) {
    // P2002 — partial unique index on (threatModelId) WHERE status IN
    // ('QUEUED','PROCESSING') AND type='SUGGEST_THREATS' fired. Another
    // job is already running for this model.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const existing = await prisma.aiJob.findFirst({
        where: {
          threatModelId,
          type: "SUGGEST_THREATS",
          status: { in: ["QUEUED", "PROCESSING"] },
        },
        select: { id: true },
      });
      logger.info(
        { threatModelId, userId, existingJobId: existing?.id },
        "SUGGEST_THREATS mutex — rejected concurrent enqueue",
      );
      return {
        conflict: true,
        existingJobId: existing?.id,
      };
    }
    throw err;
  }
}
