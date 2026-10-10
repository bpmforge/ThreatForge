/**
 * Last-resort error toast for failed mutations.
 *
 * Many mutation hooks have no onError of their own, and some call sites
 * ignore the failure too, so a failed save looked like it worked. The query
 * client calls this for every failed mutation: it stays out of the way when
 * the mutation handles errors itself (an onError in its options, or
 * `meta.silentError`), and otherwise waits briefly so call-site handlers
 * (mutate(..., { onError }) or a try/catch around mutateAsync) can show their
 * own message; only if none appeared does it show a generic one.
 */
import { ApiError } from "./api-client";
import { isReadOnlyError } from "./read-only";

/** How long call-site handlers get to show their own toast. */
const FALLBACK_DELAY_MS = 250;

export interface FallbackDeps {
  /** Number of toasts shown so far (sonner: toast.getHistory().length). */
  toastCount: () => number;
  showError: (message: string) => void;
  schedule: (fn: () => void, ms: number) => void;
}

interface MutationLike {
  options: { onError?: unknown; meta?: Record<string, unknown> };
}

/** The message a user should see for a failed save. */
export function mutationErrorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) {
    const message = error.message?.trim();
    if (message && message.length <= 200) return message;
  }
  return "Something went wrong and your change was not saved. Please try again.";
}

export function reportUnhandledMutationError(
  error: unknown,
  mutation: MutationLike,
  deps: FallbackDeps,
): void {
  if (error instanceof ApiError && error.statusCode === 401) return;
  if (isReadOnlyError(error)) return;
  if (mutation.options.onError || mutation.options.meta?.silentError) return;

  const before = deps.toastCount();
  deps.schedule(() => {
    if (deps.toastCount() > before) return; // a caller already said something
    deps.showError(mutationErrorMessage(error));
  }, FALLBACK_DELAY_MS);
}
