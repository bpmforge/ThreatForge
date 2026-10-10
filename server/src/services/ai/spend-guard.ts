/**
 * AI spend guard (AI-SPEND).
 *
 * Enforces the org's monthly AI spend cap before a job is enqueued. Spend is
 * this month's estimatedCost across the org's AIProvider records (a row whose
 * usageResetAt predates the current UTC month holds last month's usage and is
 * rolled over on its next sync — see ai-metrics.ts) plus usage recorded in
 * this process but not yet synced. When the cap is reached, new AI jobs are
 * rejected so a runaway/abusive workload can't run up an unbounded bill.
 */
import type { FastifyReply } from "fastify";
import type { getPrisma } from "../../db.js";
import { errorResponse } from "../../utils/api-response.js";
import { aiMetrics, startOfUtcMonth } from "./ai-metrics.js";

/** Stable machine-readable error code returned with the HTTP 429. */
export const AI_QUOTA_EXCEEDED_CODE = "AI_QUOTA_EXCEEDED";

export class SpendCapExceededError extends Error {
  readonly statusCode = 429;
  readonly code = AI_QUOTA_EXCEEDED_CODE;
  constructor(
    public readonly capUsd: number,
    public readonly spentUsd: number,
  ) {
    super(
      `AI monthly spend cap reached ($${spentUsd.toFixed(2)} of $${capUsd.toFixed(2)}). New AI jobs are blocked until usage resets or the cap is raised.`,
    );
    this.name = "SpendCapExceededError";
  }
}

/**
 * Throw SpendCapExceededError if the org has a cap and has reached it.
 * No cap configured (null) → always allowed.
 */
export async function assertWithinSpendCap(
  prisma: Awaited<ReturnType<typeof getPrisma>>,
  organizationId: string,
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { monthlySpendCapUsd: true },
  });
  const cap = org?.monthlySpendCapUsd;
  if (cap == null) return; // unlimited

  const agg = await prisma.aIProvider.aggregate({
    where: { organizationId, usageResetAt: { gte: startOfUtcMonth() } },
    _sum: { estimatedCost: true },
  });
  const spent =
    (agg._sum.estimatedCost ?? 0) + aiMetrics.getPendingCostUsd(organizationId);

  if (spent >= cap) {
    throw new SpendCapExceededError(cap, spent);
  }
}

/**
 * Route-level guard: if the org is over its AI quota, send HTTP 429
 * (code AI_QUOTA_EXCEEDED) and return true so the caller returns before any
 * AiJob row is created. Returns false when the job may proceed.
 */
export async function replyIfOverSpendCap(
  reply: FastifyReply,
  prisma: Awaited<ReturnType<typeof getPrisma>>,
  organizationId: string,
): Promise<boolean> {
  try {
    await assertWithinSpendCap(prisma, organizationId);
    return false;
  } catch (err) {
    if (!(err instanceof SpendCapExceededError)) throw err;
    await reply
      .status(429)
      .send(
        errorResponse(
          err.message,
          AI_QUOTA_EXCEEDED_CODE,
          { capUsd: err.capUsd, spentUsd: err.spentUsd },
          reply.request.id,
        ),
      );
    return true;
  }
}
