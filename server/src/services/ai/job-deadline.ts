/**
 * A wall-clock bound on the component analysis loop.
 *
 * B4 put a ceiling on each provider call. That does not bound the JOB: the
 * legacy and A1 paths analyse components sequentially, so total time is still
 * roughly `units x per-call timeout`. On a wide model that exceeds the
 * ai-heavy lock.
 *
 * WHY THIS BREAKS RATHER THAN THROWS — the load-bearing constraint.
 * `processAiJob`'s failure handler calls `cleanupSessionThreats` on FAILED,
 * which deletes every AI_SUGGESTED/PENDING row carrying this session's id.
 * Components are stream-persisted as they finish, so throwing on the deadline
 * would DESTROY every threat produced so far — strictly worse than the slow
 * job it is meant to fix. The other branch (CANCELLED) preserves rows but
 * reports "Cancelled by user", which is untrue, and its "checkpoint saved"
 * promise leans on stage resume that register item B6 shows is dead (no caller
 * sets `resumeExecutionId`).
 *
 * So the deadline stops the loop and lets the run COMPLETE with what it has.
 * The one thing it must never be is silent — this workstream already found a
 * 14.5-hour job that "exited 0". Callers surface `deadlineStopped` and the
 * skipped count, and the loop logs a warning naming the components it dropped.
 */
import logger from "../../utils/logger.js";

/**
 * Wall-clock budget for the analysis loop.
 *
 * Sized against the ai-heavy lock (AI_FAST/AI_HEAVY_LOCK_DURATION_MS in
 * jobs/ai-queue.ts): 35 minutes, less headroom for the stages that run AFTER
 * the identifier — calibrator, verifier, persistence. Deliberately NOT imported
 * from there: services must not depend on the job layer. A test asserts the
 * relationship instead, so the two cannot drift apart unnoticed.
 */
export const DEFAULT_ANALYSIS_BUDGET_MS = 25 * 60 * 1000;

/** Absolute deadline from a start instant. Absolute, so it cannot be re-derived per unit and drift. */
export function computeDeadlineAt(
  startedAt: number,
  budgetMs: number = DEFAULT_ANALYSIS_BUDGET_MS,
): number {
  return startedAt + budgetMs;
}

/** True once the budget is spent. An absent deadline means unbounded (previous behaviour). */
export function isPastDeadline(
  deadlineAt: number | undefined,
  now: number,
): boolean {
  return typeof deadlineAt === "number" && now >= deadlineAt;
}

/**
 * Log the stop loudly. Returns the message so callers can also surface it
 * through their own progress reporter — a bound that only shows up in logs is
 * the "exited 0" failure again.
 */
export function reportDeadlineStop(
  scope: string,
  completed: number,
  remaining: number,
  deadlineAt: number,
): string {
  const message =
    `Analysis time budget reached — stopping after ${completed} component(s), ` +
    `${remaining} not analysed. Partial results are kept.`;
  logger.warn(
    {
      scope,
      completed,
      remaining,
      deadlineAt,
      budgetMs: DEFAULT_ANALYSIS_BUDGET_MS,
    },
    "B8: analysis deadline reached — loop stopped, partial results retained",
  );
  return message;
}
