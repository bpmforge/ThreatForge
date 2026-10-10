/**
 * DELETE /api/users/me refuses when the caller is an org's sole owner. The
 * owner count included SUSPENDED owners, so an ACTIVE owner whose only
 * co-owner was suspended could delete their account and leave the org with
 * no active owner. Only ACTIVE owners count.
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

const owners = [
  { userId: "caller", role: "OWNER", status: "ACTIVE" },
  { userId: "suspended-co-owner", role: "OWNER", status: "SUSPENDED" },
];

const mockPrisma = {
  organization: {
    findMany: vi.fn(
      async (args: {
        include: { memberships: { where: { role: string; status?: string } } };
      }) => {
        const w = args.include.memberships.where;
        return [
          {
            id: "o1",
            name: "Org",
            memberships: owners.filter(
              (m) => m.role === w.role && (!w.status || m.status === w.status),
            ),
          },
        ];
      },
    ),
  },
  user: { delete: vi.fn() },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

const { userRoutes } = await import("../users.js");

describe("DELETE /api/users/me sole-owner check", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(userRoutes);
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it("a suspended co-owner does not count: the caller is still sole owner", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/users/me" });
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });
});
