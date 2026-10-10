/**
 * Shared bounded-retry helper for AI provider calls.
 *
 * Lifted from providers/lmstudio.ts `completeWithRetry` (linear backoff,
 * MAX_RETRIES=3) and generalized so callers outside the provider layer
 * (category-analyzer's first-pass aiCall) get the same transient-failure
 * protection instead of swallowing the error into a silent empty result.
 *
 * Never retries an abort/timeout (see provider-timeout.ts `isAbortError`) —
 * retrying a deliberate cancellation or a ceiling that already fired would
 * multiply the wait instead of shortening it. Callers may supply an
 * additional `isRetryable` predicate to exclude their own non-transient
 * errors (e.g. category-analyzer excludes "prompt too large" 400s, which
 * have their own minimal-prompt recovery path).
 */
import { isAbortError } from "../provider-timeout.js";

export interface RetryOptions {
  /** Total attempts including the first call. Default 3. */
  maxAttempts?: number;
  /** Linear backoff unit — wait is `baseBackoffMs * attemptNumber`. Default 5000. */
  baseBackoffMs?: number;
  /** Injectable so tests don't wait on real timers. Default: real setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  /** Extra non-retryable check beyond abort/timeout. Default: everything else retries. */
  isRetryable?: (err: unknown) => boolean;
}

function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `fn`, retrying on failure up to `maxAttempts` times with linear
 * backoff. Rethrows the last error once attempts are exhausted, or
 * immediately for an abort/timeout or a caller-flagged non-retryable error.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseBackoffMs = options.baseBackoffMs ?? 5_000;
  const sleep = options.sleep ?? realSleep;
  const isRetryable = options.isRetryable ?? (() => true);

  let attempt = 1;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (isAbortError(err) || !isRetryable(err) || attempt >= maxAttempts) {
        throw err;
      }
      await sleep(baseBackoffMs * attempt);
      attempt++;
    }
  }
}
