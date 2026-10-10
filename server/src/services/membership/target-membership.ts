/**
 * Target-membership lookup shared by the member mutations.
 */
import { getPrisma } from "../../db.js";

/**
 * The membership a mutation acts on, with its org and user. Null when it does
 * not exist or, when `organizationId` is given, belongs to another org (the
 * route's org), so callers answer "Membership not found" either way.
 */
export async function findTargetMembership(
  membershipId: string,
  organizationId?: string,
) {
  const prisma = await getPrisma();
  // nosemgrep: tf-membership-query-missing-status -- target membership looked up by id/token; any status is managed here
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: {
      organization: { select: { id: true, name: true, isPersonal: true } },
      user: { select: { id: true, email: true } },
    },
  });
  if (!membership) return null;
  if (
    organizationId !== undefined &&
    membership.organizationId !== organizationId
  )
    return null;
  return membership;
}
