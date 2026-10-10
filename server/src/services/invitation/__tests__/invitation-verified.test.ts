import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = {
  user: { findUnique: vi.fn() },
  membership: { findUnique: vi.fn(), findMany: vi.fn() },
};
vi.mock("../../../db.js", () => ({ getPrisma: async () => prisma }));

const { getPendingInvitations, acceptInvitation } = await import(
  "../invitation-service.js"
);

const token = "inv_" + "a".repeat(64);

describe("invitations need a verified email", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists nothing for an unverified account", async () => {
    prisma.user.findUnique.mockResolvedValue({
      email: "a@x.com",
      emailVerified: null,
    });
    expect(await getPendingInvitations("u1")).toEqual([]);
    expect(prisma.membership.findMany).not.toHaveBeenCalled();
  });

  it("lists invitations for a verified account", async () => {
    prisma.user.findUnique.mockResolvedValue({
      email: "a@x.com",
      emailVerified: new Date(),
    });
    prisma.membership.findMany.mockResolvedValue([]);
    await getPendingInvitations("u1");
    expect(prisma.membership.findMany).toHaveBeenCalled();
  });

  it("refuses to accept for an unverified account", async () => {
    prisma.membership.findUnique.mockResolvedValue({
      status: "PENDING",
      organization: { deletedAt: null },
      invitationExpiresAt: null,
      user: { email: "a@x.com" },
    });
    prisma.user.findUnique.mockResolvedValue({
      email: "a@x.com",
      emailVerified: null,
    });
    const result = await acceptInvitation(token, "u1", "a@x.com");
    expect(result.success).toBe(false);
  });
});
