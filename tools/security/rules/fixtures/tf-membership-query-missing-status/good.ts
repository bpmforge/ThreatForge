// Fixture: membership lookups that filter on status. None may match.
declare const prisma: any;

export async function isActiveMember(userId: string, organizationId: string) {
  const a = await prisma.membership.findFirst({
    where: { userId, organizationId, status: "ACTIVE" },
  });
  const b = await prisma.membership.findMany({
    where: { organizationId, status: { in: ["ACTIVE"] } },
    select: { userId: true },
  });
  const status = "ACTIVE";
  const c = await prisma.membership.findFirst({ where: { userId, status } });
  const d = await prisma.membership.findFirst({
    where: { AND: [{ userId }, { status: "ACTIVE" }] },
  });
  return !!(a && b && c && d);
}
