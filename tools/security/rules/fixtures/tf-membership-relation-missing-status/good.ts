// Fixture: relation filters that require an ACTIVE membership, or are not per-caller. None may match.
declare const prisma: any;

export async function visible(userId: string) {
  const a = await prisma.threatModel.findMany({
    where: {
      project: {
        organization: { memberships: { some: { userId, status: "ACTIVE" } } },
      },
    },
  });
  const b = await prisma.project.findUnique({
    where: { id: "p" },
    include: {
      organization: {
        include: {
          memberships: { where: { userId: userId, status: "ACTIVE" } },
        },
      },
    },
  });
  // Listing every member (no per-caller userId) is not an access check.
  const c = await prisma.organization.findUnique({
    where: { id: "o" },
    include: { memberships: { select: { role: true, userId: true } } },
  });
  return [a, b, c];
}
