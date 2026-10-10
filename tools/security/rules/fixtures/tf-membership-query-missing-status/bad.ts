// Fixture: membership lookups with no status filter. Each MUST match (3).
declare const prisma: any;

export async function isMember(userId: string, organizationId: string) {
  const a = await prisma.membership.findFirst({
    where: { userId, organizationId },
  });
  const b = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  const c = await prisma.membership.findMany({
    where: { organizationId },
    select: { userId: true },
  });
  return !!(a && b && c);
}
