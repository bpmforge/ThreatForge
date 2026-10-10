/**
 * Enforces the admin "require two-factor" setting on the API.
 *
 * The app layout also redirects such users to the setup page, but that is
 * only a client hint. Register `mfaRequiredGuard` as a preHandler after
 * `authenticate` in the protected-routes scope.
 *
 * Sign-out runs in Next.js, and /api/auth/* is outside the protected scope,
 * so the only routes to leave open are the ones used to turn 2FA on.
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import { getPrisma } from "../db.js";

const MFA_SETUP_REQUIRED_CODE = "MFA_SETUP_REQUIRED";

const CACHE_TTL_MS = 60_000;
let cached: { required: boolean; at: number } | null = null;

/** Clears the cached setting (tests, or right after an admin changes it). */
export function resetMfaRequiredCache(): void {
  cached = null;
}

async function isMfaRequired(): Promise<boolean> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.required;
  const prisma = await getPrisma();
  const settings = await prisma.systemSettings.findFirst({
    where: { id: "default" },
    select: { mfaRequired: true },
  });
  cached = { required: settings?.mfaRequired ?? false, at: Date.now() };
  return cached.required;
}

function isSetupRoute(url: string): boolean {
  const path = url.split("?")[0].replace(/\/+$/, "");
  return (
    path === "/api/users/me" || path.startsWith("/api/users/me/two-factor")
  );
}

export async function mfaRequiredGuard(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = request.authUser;
  // API tokens are machine credentials and cannot hold a second factor
  if (!user || user.apiTokenId) return;
  if (isSetupRoute(request.url)) return;
  if (!(await isMfaRequired())) return;

  const prisma = await getPrisma();
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { twoFactorEnabled: true },
  });
  if (row?.twoFactorEnabled) return;

  return reply.status(403).send({
    error: "Forbidden",
    code: MFA_SETUP_REQUIRED_CODE,
    message: "Two-factor authentication must be set up before continuing.",
  });
}
