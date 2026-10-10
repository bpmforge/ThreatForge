// Fixture: relation filters on a caller's membership with no status. Each MUST match (3).
declare const prisma: any;

export async function visible(userId: string) {
  const a = await prisma.threatModel.findMany({
    where: {
      project: { organization: { memberships: { some: { userId } } } },
    },
  });
  const b = await prisma.project.findUnique({
    where: { id: "p" },
    include: {
      organization: {
        include: { memberships: { where: { userId: userId } } },
      },
    },
  });
  const c = await prisma.organization.findMany({
    where: { memberships: { some: { userId, role: "OWNER" } } },
  });
  return [a, b, c];
}
