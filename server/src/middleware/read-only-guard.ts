/**
 * Read-only accounts (the public demo login).
 *
 * An operator lists accounts in DEMO_READONLY_USER_EMAILS (comma-separated).
 * Those users may read everything their memberships allow and change nothing:
 * every request that is not GET/HEAD/OPTIONS is rejected here, in the one
 * preHandler that runs after `authenticate` on every protected route. That
 * includes organization creation, which is how a demo login escalated before.
 *
 * There is no allowlist on purpose. Logout and session refresh never reach
 * this hook (NextAuth signOut runs in Next.js; /api/auth/refresh is outside
 * the protected scope), and the only automatic write the UI makes — saving
 * tutorial progress to /api/users/me/preferences — fails quietly without it.
 *
 * The collaboration websocket enforces the same rule separately (it is not a
 * protected route): see the receive-only client in services/collaboration.ts.
 */
import type { FastifyReply, FastifyRequest } from "fastify";

export const READ_ONLY_ERROR_CODE = "READ_ONLY_ACCOUNT";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isReadOnlyUser(
  email: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!email) return false;
  const listed = (env.DEMO_READONLY_USER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return listed.includes(email.toLowerCase());
}

export async function readOnlyGuard(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (SAFE_METHODS.has(request.method)) return;
  if (!isReadOnlyUser(request.authUser?.email)) return;
  request.log.info(
    { userId: request.authUser?.id, method: request.method, url: request.url },
    "read-only account write rejected",
  );
  return reply.status(403).send({
    error: "Forbidden",
    code: READ_ONLY_ERROR_CODE,
    message:
      "This is a read-only demo account. Sign up for your own account to create and edit threat models.",
  });
}
