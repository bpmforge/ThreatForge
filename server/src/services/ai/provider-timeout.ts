/**
 * A ceiling on every provider completion call.
 *
 * None of the six providers passed an AbortSignal to `fetch`, so a provider
 * that accepted the connection and then went quiet hung the call forever. Field
 * evidence from the AI cleanup workstream: a dead local provider turned a
 * 25-minute job into a 14.5-hour one that still exited 0, because LM Studio's
 * loader eventually recovered and the run completed — just catastrophically
 * late.
 *
 * SCOPE, stated because the arithmetic matters: this bounds ONE call. The
 * micro-analysis fan-out is sequential (`for (const compCtx of ...)` over
 * components × methodologies), so total job time is still roughly
 * `units × timeout`, which on a wide model exceeds the ai-heavy lock of 35
 * minutes. Bounding the JOB needs a deadline the fan-out checks between units;
 * that is a separate finding, not this one.
 */

/** Default ceiling for a single completion. Generous — local models are slow. */
export const DEFAULT_PROVIDER_TIMEOUT_MS = 120_000;

const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 900_000;

/**
 * Per-call ceiling, overridable with AI_PROVIDER_TIMEOUT_MS and clamped so a
 * typo ("0", "999999999") cannot reintroduce an effectively unbounded call.
 */
export function providerTimeoutMs(): number {
  const raw = process.env.AI_PROVIDER_TIMEOUT_MS;
  if (!raw) return DEFAULT_PROVIDER_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PROVIDER_TIMEOUT_MS;
  }
  return Math.min(Math.max(parsed, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
}

/**
 * Signal for a completion request: the timeout, combined with the caller's own
 * signal when there is one so job cancellation still propagates.
 */
export function completionSignal(caller?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(providerTimeoutMs());
  return caller ? AbortSignal.any([caller, timeout]) : timeout;
}

/**
 * True for an abort — either the timeout firing or the caller cancelling.
 *
 * Load-bearing in lmstudio: its completion `catch` treats every network-level
 * throw as transient and retries. Without this check a 120s timeout would
 * become 3 × 120s plus backoff, and the pipeline's own retry loop would
 * multiply that again — making the timeout worse than no timeout.
 */
export function isAbortError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === "AbortError" || err.name === "TimeoutError";
}
