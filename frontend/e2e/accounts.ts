/**
 * E2E login accounts.
 *
 * DEMO — the public demo login. On the public host it is READ-ONLY (the server
 * lists it in DEMO_READONLY_USER_EMAILS): it can sign in and look, and every
 * write is rejected with 403 READ_ONLY_ACCOUNT. Specs that only check what the
 * demo shows keep using it.
 *
 * WRITER — the account for specs that create, edit or delete. Set
 *   E2E_WRITER_EMAIL / E2E_WRITER_PASSWORD
 * to a separate account that owns its own organization (NOT a member of the
 * demo organization, so a test cleanup can never touch the demo models).
 * Unset, it falls back to the demo login: right for a local or staging stack
 * where the demo is writable, and a skip (see writerSkipReason) on the public
 * host, where it is not.
 */
import { PUBLIC_HOST } from "./demo-models";

export const DEMO_EMAIL = "demo-tour@threatforge.local";
export const DEMO_PASSWORD = "DemoTour2026!";

const writerConfigured = Boolean(
  process.env.E2E_WRITER_EMAIL && process.env.E2E_WRITER_PASSWORD,
);

export const WRITER_EMAIL = process.env.E2E_WRITER_EMAIL || DEMO_EMAIL;
export const WRITER_PASSWORD = process.env.E2E_WRITER_PASSWORD || DEMO_PASSWORD;

/**
 * Why a writing spec cannot run here, or null when it can. Use as
 * `test.skip(!!writerSkipReason(), writerSkipReason() ?? "")`.
 */
export function writerSkipReason(): string | null {
  if (writerConfigured) return null;
  const target = process.env.TOUR_BASE_URL || `https://${PUBLIC_HOST}`;
  if (new URL(target).hostname !== PUBLIC_HOST) return null;
  return (
    `the demo account is read-only on ${PUBLIC_HOST}; ` +
    "set E2E_WRITER_EMAIL and E2E_WRITER_PASSWORD to run specs that write"
  );
}
