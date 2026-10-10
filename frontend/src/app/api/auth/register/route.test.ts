/**
 * Registration: verification tokens are stored hashed, the admin settings
 * (sign-ups, password policy) are enforced, and the response does not reveal
 * whether an address already has an account.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const tx = {
  user: { create: vi.fn(), update: vi.fn() },
  organization: { create: vi.fn() },
  membership: { create: vi.fn() },
  auditLog: { create: vi.fn() },
};
const mockPrisma = {
  user: { findUnique: vi.fn() },
  systemSettings: { findUnique: vi.fn() },
  $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
};

vi.mock("@/lib/prisma", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("@/lib/username", () => ({
  generateUsername: vi.fn(() => Promise.resolve("user")),
  generatePersonalOrgSlug: vi.fn(() => "user-personal"),
}));
vi.mock("@/lib/backend-url", () => ({
  internalBackendUrl: vi.fn(() => "http://backend"),
}));

const { POST } = await import("./route");

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("{}"))),
    );
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.systemSettings.findUnique.mockResolvedValue({
      allowSignups: true,
      emailProvider: "smtp",
      requireEmailVerification: true,
      passwordMinLength: 12,
      passwordRequireUppercase: true,
      passwordRequireLowercase: true,
      passwordRequireNumbers: true,
      passwordRequireSpecialChars: false,
    });
    tx.user.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: "u1", ...data }),
    );
    tx.organization.create.mockResolvedValue({ id: "org1" });
  });

  it("stores the verification token as sha256:<hex>", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: "User",
          email: "user@example.com",
          password: "Str0ng!Passw0rd",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const stored = tx.user.create.mock.calls[0][0].data.verificationToken;
    expect(stored).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  function register(fields: Record<string, string>) {
    return POST(
      new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: "User",
          email: "user@example.com",
          password: "Str0ng!Passw0rd",
          ...fields,
        }),
      }),
    );
  }

  it("leaves emailVerified empty when no email provider is configured", async () => {
    mockPrisma.systemSettings.findUnique.mockResolvedValue({
      allowSignups: true,
      emailProvider: null,
      requireEmailVerification: true,
      passwordMinLength: 12,
      passwordRequireUppercase: true,
      passwordRequireLowercase: true,
      passwordRequireNumbers: true,
      passwordRequireSpecialChars: false,
    });
    await register({});
    const data = tx.user.create.mock.calls[0][0].data;
    expect(data.status).toBe("ACTIVE");
    expect(data.emailVerified).toBeNull();
  });

  it("refuses when sign-ups are disabled", async () => {
    mockPrisma.systemSettings.findUnique.mockResolvedValue({
      allowSignups: false,
    });
    const res = await register({});
    expect(res.status).toBe(403);
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it("applies the configured password policy", async () => {
    mockPrisma.systemSettings.findUnique.mockResolvedValue({
      allowSignups: true,
      passwordMinLength: 20,
      passwordRequireUppercase: true,
      passwordRequireLowercase: true,
      passwordRequireNumbers: true,
      passwordRequireSpecialChars: false,
    });
    const res = await register({});
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Password must be at least 20 characters",
    });
  });

  it("answers an existing address the same way as a new one", async () => {
    const fresh = await (await register({})).json();
    mockPrisma.user.findUnique.mockResolvedValue({ id: "existing" });
    const res = await register({ email: "USER@example.com " });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(fresh);
    expect(mockPrisma.user.findUnique).toHaveBeenLastCalledWith({
      where: { email: "user@example.com" },
    });
    expect(tx.user.create).toHaveBeenCalledTimes(1);
  });
});
