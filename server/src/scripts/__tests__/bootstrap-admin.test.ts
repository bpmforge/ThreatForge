/**
 * bootstrap-admin must never mint or promote a super-admin from stale or
 * placeholder env values (a default "ChangeMe123x" admin reached prod once).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockPrisma = {
  user: { count: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
  auditLog: { create: vi.fn() },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

const { bootstrapSystemAdmin } = await import("../bootstrap-admin.js");

describe("bootstrapSystemAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("INITIAL_SYSTEM_ADMIN_EMAIL", "admin@example.com");
    vi.stubEnv("INITIAL_SYSTEM_ADMIN_PASSWORD", "a-real-long-password-123");
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.user.findUnique.mockResolvedValue(null);
  });

  it("skips when a system admin already exists", async () => {
    mockPrisma.user.count.mockResolvedValue(1);

    const result = await bootstrapSystemAdmin();

    expect(result.action).toBe("skipped");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("does not promote an existing account once an admin exists", async () => {
    mockPrisma.user.count.mockResolvedValue(1);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      isSuperAdmin: false,
      name: "Squatter",
    });

    const result = await bootstrapSystemAdmin();

    expect(result.action).toBe("skipped");
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it.each([
    "ChangeMe123x",
    "CHANGE_THIS_STRONG_PASSWORD",
    "SecurePassword123!",
  ])("refuses the placeholder password %s", async (pw) => {
    vi.stubEnv("INITIAL_SYSTEM_ADMIN_PASSWORD", pw);

    const result = await bootstrapSystemAdmin();

    expect(result.success).toBe(false);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a password shorter than 12 characters", async () => {
    vi.stubEnv("INITIAL_SYSTEM_ADMIN_PASSWORD", "short-pw-1");

    const result = await bootstrapSystemAdmin();

    expect(result.success).toBe(false);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
