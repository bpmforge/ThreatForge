/**
 * A password reset must end NextAuth sessions issued before it. The jwt
 * callback runs on every session read; returning null makes Auth.js clear
 * the session cookie.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockPrisma = {
  user: { findUnique: vi.fn(), update: vi.fn() },
  account: { findUnique: vi.fn() },
  systemSettings: { findFirst: vi.fn() },
  membership: { findMany: vi.fn() },
};

vi.mock("./prisma", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

const { authCallbacks, authEvents, providerAssertsVerifiedEmail } =
  await import("./auth-callbacks");

const nowSec = () => Math.floor(Date.now() / 1000);

describe("authCallbacks.jwt after a password change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.systemSettings.findFirst.mockResolvedValue({
      sessionTimeoutHours: 24,
    });
  });

  it("returns null for a session issued before the password changed", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      passwordChangedAt: new Date(Date.now() - 1000 * 5),
    });
    const result = await authCallbacks.jwt({
      token: { id: "user-1", iat: nowSec() - 60 },
    });
    expect(result).toBeNull();
  });

  it("keeps a session issued after the password changed", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      passwordChangedAt: new Date(Date.now() - 1000 * 60),
    });
    const token = { id: "user-1", iat: nowSec() - 5 };
    const result = await authCallbacks.jwt({ token });
    expect(result).toEqual(token);
  });

  it("returns null for a session issued before sign out everywhere", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      passwordChangedAt: null,
      sessionsRevokedAt: new Date(Date.now() - 1000 * 5),
    });
    const result = await authCallbacks.jwt({
      token: { id: "user-1", iat: nowSec() - 60 },
    });
    expect(result).toBeNull();
  });

  it("keeps a session for a user who never changed their password", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ passwordChangedAt: null });
    const token = { id: "user-1", iat: nowSec() - 60 };
    const result = await authCallbacks.jwt({ token });
    expect(result).toEqual(token);
  });
});

describe("authCallbacks.signIn for OAuth", () => {
  const account = { provider: "google", providerAccountId: "g1" };
  beforeEach(() => vi.clearAllMocks());

  it("refuses a new account when sign-ups are closed", async () => {
    mockPrisma.account.findUnique.mockResolvedValue(null);
    mockPrisma.systemSettings.findFirst.mockResolvedValue({
      allowSignups: false,
    });
    expect(await authCallbacks.signIn({ user: { id: "g1" }, account })).toBe(
      false,
    );
  });

  it("lets an existing linked account in when sign-ups are closed", async () => {
    mockPrisma.account.findUnique.mockResolvedValue({ id: "a1" });
    mockPrisma.systemSettings.findFirst.mockResolvedValue({
      allowSignups: false,
    });
    expect(await authCallbacks.signIn({ user: { id: "u1" }, account })).toBe(
      true,
    );
  });

  it("lets a pre-created user sign in by SSO when sign-ups are closed", async () => {
    mockPrisma.account.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1" });
    mockPrisma.systemSettings.findFirst.mockResolvedValue({
      allowSignups: false,
    });
    const user = { id: "g1", email: "Pat@Example.com" };
    expect(await authCallbacks.signIn({ user, account })).toBe(true);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "pat@example.com" },
      select: { id: true },
    });
  });

  it("allows a new account when sign-ups are open", async () => {
    mockPrisma.account.findUnique.mockResolvedValue(null);
    mockPrisma.systemSettings.findFirst.mockResolvedValue({
      allowSignups: true,
    });
    expect(await authCallbacks.signIn({ user: { id: "g1" }, account })).toBe(
      true,
    );
  });
});

describe("OAuth email verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MICROSOFT_TENANT_ID;
  });

  it("trusts Google only when email_verified is true", async () => {
    const a = { provider: "google" };
    expect(
      await providerAssertsVerifiedEmail(a, {
        email: "a@x.com",
        email_verified: true,
      }),
    ).toBe(true);
    expect(
      await providerAssertsVerifiedEmail(a, {
        email: "a@x.com",
        email_verified: false,
      }),
    ).toBe(false);
  });

  it("does not trust Entra on the common tenant or SAML", async () => {
    const profile = { email: "a@x.com" };
    expect(
      await providerAssertsVerifiedEmail(
        { provider: "microsoft-entra-id" },
        profile,
      ),
    ).toBe(false);
    expect(
      await providerAssertsVerifiedEmail({ provider: "boxyhq-saml" }, profile),
    ).toBe(false);
  });

  it("requires GitHub's primary verified email", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify([
            { email: "a@x.com", primary: true, verified: false },
            { email: "b@x.com", primary: false, verified: true },
          ]),
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const a = { provider: "github", access_token: "t" };
    expect(await providerAssertsVerifiedEmail(a, { email: "a@x.com" })).toBe(
      false,
    );
    expect(await providerAssertsVerifiedEmail(a, { email: "b@x.com" })).toBe(
      false,
    );
    vi.unstubAllGlobals();
  });

  it("marks a new user verified only when the provider vouches", async () => {
    await authEvents.signIn({
      user: { id: "u1" },
      account: { provider: "google" },
      profile: { email: "a@x.com", email_verified: true },
      isNewUser: true,
    });
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
    await authEvents.signIn({
      user: { id: "u2" },
      account: { provider: "boxyhq-saml" },
      profile: { email: "a@x.com" },
      isNewUser: true,
    });
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
  });
});
