/**
 * Which organization's AI settings and budget an org-less AI request uses.
 *
 * The client sends the organization the user is working in. Without one, the
 * user's default organization is used when they are still an ACTIVE member of
 * it, otherwise their oldest ACTIVE membership, so the choice is stable
 * instead of depending on row order.
 */
import { getPrisma } from "../../db.js";

export interface AiOrganization {
  id: string;
  aiSettings: string | null;
}

/** The organization, or null when the user may not use it (or has none). */
export async function resolveAiOrganization(
  userId: string,
  requestedOrgId: string | undefined,
): Promise<AiOrganization | null> {
  const prisma = await getPrisma();
  const select = { organization: { select: { id: true, aiSettings: true } } };

  if (requestedOrgId) {
    const membership = await prisma.membership.findFirst({
      where: { userId, organizationId: requestedOrgId, status: "ACTIVE" },
      select,
    });
    return membership?.organization ?? null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultOrganizationId: true },
  });
  const membership =
    (user?.defaultOrganizationId &&
      (await prisma.membership.findFirst({
        where: {
          userId,
          organizationId: user.defaultOrganizationId,
          status: "ACTIVE",
        },
        select,
      }))) ||
    (await prisma.membership.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select,
    }));
  return membership?.organization ?? null;
}

/** The organization id a request names in its body or query string. */
export function requestedOrganizationId(request: {
  body?: unknown;
  query?: unknown;
}): string | undefined {
  for (const source of [request.body, request.query]) {
    const value = (source as { organizationId?: unknown } | undefined)
      ?.organizationId;
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

/** The AI organization for a request from `userId` (see resolveAiOrganization). */
export function aiOrgForRequest(
  userId: string,
  request: { body?: unknown; query?: unknown },
): Promise<AiOrganization | null> {
  return resolveAiOrganization(userId, requestedOrganizationId(request));
}
