/**
 * Read-only accounts (the public demo login). The server rejects their writes
 * with 403 { code: "READ_ONLY_ACCOUNT" }; see server/src/middleware/read-only-guard.ts.
 */
import { ApiError } from "./api-client";

const READ_ONLY_ERROR_CODE = "READ_ONLY_ACCOUNT";

/** The server's message, for fetch helpers that keep only `message`. */
const READ_ONLY_MESSAGE = /read-only demo account/i;

export const READ_ONLY_TOAST =
  "The demo account is read-only. Sign up for your own account to make changes.";

export function isReadOnlyError(error: unknown): boolean {
  if (error instanceof ApiError && error.code === READ_ONLY_ERROR_CODE) {
    return true;
  }
  return error instanceof Error && READ_ONLY_MESSAGE.test(error.message);
}
