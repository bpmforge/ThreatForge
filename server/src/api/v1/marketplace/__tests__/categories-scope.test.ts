/**
 * GET /api/v1/marketplace/categories returned every tenant's custom threat
 * categories with their organization ids and names. Categories have no
 * public flag, so the caller sees only those of orgs they are ACTIVE in.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { createFakePrisma } from "../../../../test/helpers/fake-prisma.js";

const createdAt = new Date();
const prisma = createFakePrisma({
  customThreatCategory: [
    {
      id: "c-mine",
      organizationId: "oA",
      name: "Mine",
      isActive: true,
      createdAt,
    },
    {
      id: "c-other",
      organizationId: "oB",
      name: "Theirs",
      isActive: true,
      createdAt,
    },
  ],
});
vi.mock("../../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(prisma)),
}));
vi.mock(
  "../../../../services/access-control/access-control-service.js",
  async () =>
    (await import("../../../../test/helpers/access-control-mock.js"))
      .accessControlModule,
);

const { orgRoles } = await import(
  "../../../../test/helpers/access-control-mock.js"
);
const { browseRoutes } = await import("../browse-routes.js");

describe("marketplace categories are scoped to the caller's orgs", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    orgRoles.set("oA", "VIEWER");
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(browseRoutes);
    await app.ready();
  });
  afterAll(() => app.close());

  it("omits other tenants' categories", async () => {
    const res = await app.inject({ method: "GET", url: "/categories" });
    expect(res.statusCode).toBe(200);
    const ids = res.json().data.data.map((c: { id: string }) => c.id);
    expect(ids).toEqual(["c-mine"]);
  });
});
