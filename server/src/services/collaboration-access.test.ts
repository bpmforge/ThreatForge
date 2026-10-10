import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const canAccess = vi.fn();
const canEdit = vi.fn();

vi.mock("../db.js", () => ({
  getPrisma: async () => ({ user: { findUnique } }),
}));
vi.mock("../api/threat-models/helpers.js", () => ({
  canAccessThreatModel: (...a: unknown[]) => canAccess(...a),
  canEditThreatModel: (...a: unknown[]) => canEdit(...a),
}));

const { resolveCollaborationAccess } = await import(
  "./collaboration-access.js"
);

const access = { id: "u1", type: "access" as const, iat: 1000 };

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue({
    email: "a@example.com",
    status: "ACTIVE",
    passwordChangedAt: null,
  });
  canAccess.mockResolvedValue(true);
  canEdit.mockResolvedValue(true);
});

describe("resolveCollaborationAccess", () => {
  it("lets an editor write", async () => {
    expect(await resolveCollaborationAccess(access, "m1")).toEqual({
      ok: true,
      receiveOnly: false,
    });
  });

  it("makes a viewer receive-only", async () => {
    canEdit.mockResolvedValue(false);
    expect(await resolveCollaborationAccess(access, "m1")).toEqual({
      ok: true,
      receiveOnly: true,
    });
  });

  it("rejects a refresh token", async () => {
    const r = await resolveCollaborationAccess(
      { ...access, type: "refresh" },
      "m1",
    );
    expect(r).toMatchObject({ ok: false, code: 4001 });
  });

  it("rejects an inactive account", async () => {
    findUnique.mockResolvedValue({
      email: "a@example.com",
      status: "SUSPENDED",
      passwordChangedAt: null,
    });
    expect(await resolveCollaborationAccess(access, "m1")).toMatchObject({
      ok: false,
      code: 4001,
    });
  });

  it("rejects a token issued before a password change", async () => {
    findUnique.mockResolvedValue({
      email: "a@example.com",
      status: "ACTIVE",
      passwordChangedAt: new Date(5000 * 1000),
    });
    expect(await resolveCollaborationAccess(access, "m1")).toMatchObject({
      ok: false,
      code: 4001,
    });
  });

  it("denies a user with no access to the model", async () => {
    canAccess.mockResolvedValue(false);
    expect(await resolveCollaborationAccess(access, "m1")).toMatchObject({
      ok: false,
      code: 4003,
    });
  });
});
