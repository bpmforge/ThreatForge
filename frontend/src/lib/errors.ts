/** The error's message, or `fallback` when it is not an Error or has no message. */
export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
