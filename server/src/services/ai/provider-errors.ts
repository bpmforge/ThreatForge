/**
 * Error kinds callers above the provider layer must tell apart.
 *
 * - ProviderRetriesExhaustedError: the provider already retried a transient
 *   failure (crashed/reloading local model, 5xx, network) and gave up.
 *   Retrying again outside multiplies the calls (3 × 3 = 9) for nothing.
 * - isPromptTooLargeError: a 400 whose message is about context length. Only
 *   this one should fall back to a smaller prompt; a crashed model or a
 *   schema error also arrives as 400 and must not.
 */
export class ProviderRetriesExhaustedError extends Error {
  readonly retriesExhausted = true;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ProviderRetriesExhaustedError";
  }
}

const CONTEXT_TOO_LARGE =
  /context (length|size|window)|too (long|large)|maximum context|exceeds? (the )?(maximum|max|context)|n_ctx|token limit|too many tokens/i;

export function isPromptTooLargeError(err: unknown): boolean {
  if (err instanceof ProviderRetriesExhaustedError) return false;
  const message = err instanceof Error ? err.message : String(err);
  return /\b400\b/.test(message) && CONTEXT_TOO_LARGE.test(message);
}
