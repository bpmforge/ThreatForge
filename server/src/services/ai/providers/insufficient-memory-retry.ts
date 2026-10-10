/**
 * back off and retry when a local model server answers HTTP 507.
 *
 * MTPLX's active memory climbs over a long run and the server refuses
 * prefill with 507 ("insufficient memory") once it crosses its budget; it
 * releases that memory only when it idles. Seed 11 lost every call after
 * category analysis to back-to-back 507s, while the one 507 that the
 * category analyzer retried after a 5 s backoff succeeded. So a 507 is
 * retried after an escalating pause instead of being passed straight up.
 *
 * limitInflight runs this inside the endpoint's slot, so no queued caller
 * reaches the server during the idle window the retry is waiting for.
 */
import logger from "../../../utils/logger.js";

/** Pause before each retry; one retry per entry. */
export const INSUFFICIENT_MEMORY_BACKOFF_MS = [5_000, 15_000, 45_000];

/** Providers throw `<Provider> error: <status> - <body>`. */
export function isInsufficientMemoryError(err: unknown): boolean {
  return err instanceof Error && /\berror: 507\b/i.test(err.message);
}

export interface InsufficientMemoryRetryOptions {
  signal?: AbortSignal;
  /** Injectable so tests don't wait on real timers. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Run `fn`; on a 507, wait INSUFFICIENT_MEMORY_BACKOFF_MS[i] and try again.
 * Rethrows any other error at once, and the last 507 once the steps run out.
 */
export async function retryOnInsufficientMemory<T>(
  fn: () => Promise<T>,
  options: InsufficientMemoryRetryOptions = {},
): Promise<T> {
  const sleep = options.sleep ?? abortableSleep;
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        logger.info({ attempt }, "Provider recovered after HTTP 507 backoff");
      }
      return result;
    } catch (err) {
      const backoffMs = INSUFFICIENT_MEMORY_BACKOFF_MS[attempt];
      if (!isInsufficientMemoryError(err) || backoffMs === undefined) throw err;
      logger.warn(
        { attempt: attempt + 1, backoffMs },
        "Provider answered HTTP 507 (insufficient memory); backing off",
      );
      await sleep(backoffMs, options.signal);
    }
  }
}
