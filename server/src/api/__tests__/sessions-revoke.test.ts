import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

const update = vi.fn();
const invalidate = vi.fn();
vi.mock("../../db.js", () => ({
  getPrisma: async () => ({ user: { update } }),
}));
vi.mock("../../middleware/auth.js", () => ({
  invalidateSessionCache: (id: string) => invalidate(id),
}));
vi.mock("../../utils/auth-helpers.js", () => ({
  getAuthUser: () => ({ id: "u1" }),
}));

const { sessionRoutes } = await import("../sessions.js");

describe("POST /api/users/me/sessions/revoke-all", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stamps sessionsRevokedAt and drops cached sessions", async () => {
    const app = Fastify();
    await app.register(sessionRoutes);
    const res = await app.inject({
      method: "POST",
      url: "/api/users/me/sessions/revoke-all",
    });
    expect(res.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { sessionsRevokedAt: expect.any(Date) },
    });
    expect(invalidate).toHaveBeenCalledWith("u1");
  });
});
