import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = {
  systemSettings: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
};
vi.mock("../db.js", () => ({ getPrisma: async () => prisma }));

const { mfaRequiredGuard, resetMfaRequiredCache } = await import(
  "./mfa-required.js"
);

function run(url: string, authUser: object | undefined = { id: "u1" }) {
  const send = vi.fn();
  const status = vi.fn(() => ({ send }));
  const reply = { status } as never;
  return mfaRequiredGuard({ url, authUser } as never, reply).then(() => ({
    status,
    send,
  }));
}

describe("mfaRequiredGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMfaRequiredCache();
    prisma.systemSettings.findFirst.mockResolvedValue({ mfaRequired: true });
    prisma.user.findUnique.mockResolvedValue({ twoFactorEnabled: false });
  });

  it("rejects a user without 2FA when it is required", async () => {
    const { status, send } = await run("/api/threat-models");
    expect(status).toHaveBeenCalledWith(403);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ code: "MFA_SETUP_REQUIRED" }),
    );
  });

  it("leaves the 2FA setup routes and /me open", async () => {
    for (const url of [
      "/api/users/me",
      "/api/users/me?x=1",
      "/api/users/me/two-factor/setup",
    ]) {
      expect((await run(url)).status).not.toHaveBeenCalled();
    }
  });

  it("lets a user with 2FA through", async () => {
    prisma.user.findUnique.mockResolvedValue({ twoFactorEnabled: true });
    expect((await run("/api/threat-models")).status).not.toHaveBeenCalled();
  });

  it("does nothing when the setting is off", async () => {
    prisma.systemSettings.findFirst.mockResolvedValue({ mfaRequired: false });
    expect((await run("/api/threat-models")).status).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("skips API tokens", async () => {
    const { status } = await run("/api/threat-models", {
      id: "u1",
      apiTokenId: "t1",
    });
    expect(status).not.toHaveBeenCalled();
  });

  it("caches the setting", async () => {
    await run("/api/a");
    await run("/api/b");
    expect(prisma.systemSettings.findFirst).toHaveBeenCalledTimes(1);
  });
});
