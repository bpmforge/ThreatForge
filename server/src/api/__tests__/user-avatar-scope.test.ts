/**
 * GET /api/users/:userId/avatar is visible to the user themselves and to
 * people who share an organization with them; anyone else gets 404, so the
 * route no longer reveals which user ids exist.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

const caller = { id: "caller", email: "c@x.test", name: "Caller" };

const mockPrisma = {
  user: { findUnique: vi.fn() },
  membership: { findFirst: vi.fn() },
};
vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

const { uploadRoutes } = await import("../uploads.js");

describe("GET /api/users/:userId/avatar", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = caller;
    });
    await app.register(uploadRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({
      avatarUrl: "https://a/x.png",
      image: null,
      name: "Target",
    });
  });

  it("serves a user who shares an ACTIVE org with the caller", async () => {
    mockPrisma.membership.findFirst.mockResolvedValue({ id: "m" });
    const res = await app.inject({
      method: "GET",
      url: "/api/users/target/avatar",
    });
    expect(res.statusCode).toBe(200);
    const where = mockPrisma.membership.findFirst.mock.calls[0][0].where;
    expect(where.userId).toBe("target");
    expect(JSON.stringify(where)).toContain('"userId":"caller"');
    expect(JSON.stringify(where)).toContain('"status":"ACTIVE"');
  });

  it("answers 404 for a user who shares no org with the caller", async () => {
    mockPrisma.membership.findFirst.mockResolvedValue(null);
    const res = await app.inject({
      method: "GET",
      url: "/api/users/target/avatar",
    });
    expect(res.statusCode).toBe(404);
  });

  it("always serves the caller's own avatar", async () => {
    mockPrisma.membership.findFirst.mockResolvedValue(null);
    const res = await app.inject({
      method: "GET",
      url: "/api/users/caller/avatar",
    });
    expect(res.statusCode).toBe(200);
  });
});
