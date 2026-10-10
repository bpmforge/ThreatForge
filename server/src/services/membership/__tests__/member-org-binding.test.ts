/**
 * Member role change, suspend and unsuspend must act only on a membership
 * that belongs to the organization in the URL (DELETE already does).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const prisma: Record<string, unknown> & {
  membership: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
} = {
  membership: { findUnique: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(async (ops: unknown) =>
    Array.isArray(ops)
      ? Promise.all(ops)
      : (ops as (p: unknown) => unknown)(prisma),
  ),
};
vi.mock("../../../db.js", () => ({ getPrisma: vi.fn(async () => prisma) }));

const { updateMemberRole } = await import("../role-service.js");
const { suspendMember, unsuspendMember } = await import(
  "../suspension-service.js"
);

const target = (status: string) => ({
  id: "m-b",
  organizationId: "org-b",
  userId: "victim",
  role: "VIEWER",
  status,
  organization: { id: "org-b", name: "B", isPersonal: false },
  user: { id: "victim", email: "v@b.test" },
});
const caller = { userId: "admin", role: "OWNER", status: "ACTIVE" };

describe("member mutations are bound to the URL organization", () => {
  let currentStatus = "ACTIVE";
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.membership.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(where.id ? target(currentStatus) : caller),
    );
  });

  it("updateMemberRole refuses a membership from another org", async () => {
    currentStatus = "ACTIVE";
    const result = await updateMemberRole({
      membershipId: "m-b",
      organizationId: "org-a",
      newRole: "EDITOR",
      updatingUserId: "admin",
      updatingUserEmail: "a@a.test",
    });
    expect(result).toEqual({ success: false, error: "Membership not found" });
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });

  it("suspendMember refuses a membership from another org", async () => {
    currentStatus = "ACTIVE";
    const result = await suspendMember({
      membershipId: "m-b",
      organizationId: "org-a",
      suspendingUserId: "admin",
      suspendingUserEmail: "a@a.test",
    });
    expect(result).toEqual({ success: false, error: "Membership not found" });
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });

  it("unsuspendMember refuses a membership from another org", async () => {
    currentStatus = "SUSPENDED";
    const result = await unsuspendMember({
      membershipId: "m-b",
      organizationId: "org-a",
      unsuspendingUserId: "admin",
      unsuspendingUserEmail: "a@a.test",
    });
    expect(result).toEqual({ success: false, error: "Membership not found" });
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });

  it("updateMemberRole still works inside the URL org", async () => {
    currentStatus = "ACTIVE";
    prisma.membership.update.mockResolvedValue({});
    const result = await updateMemberRole({
      membershipId: "m-b",
      organizationId: "org-b",
      newRole: "EDITOR",
      updatingUserId: "admin",
      updatingUserEmail: "a@a.test",
    });
    expect(result.success).toBe(true);
  });
});
