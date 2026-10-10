/**
 * Three small cross-org leaks found while annotating routes:
 * - GET /api/presence counted live collaborators on any model id;
 * - GET /api/v1/model-templates/categories counted every org's private templates;
 * - GET /api/v1/risk-frameworks/:frameworkId/presets confirmed another org's
 *   framework and its type.
 * Each now answers only for what the caller can see.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";

const caller = { id: "caller", email: "c@x.test", name: "C" };

const prisma = {
  membership: { findMany: vi.fn() },
  modelTemplate: { groupBy: vi.fn() },
  riskFramework: { findUnique: vi.fn() },
};
vi.mock("../../db.js", () => ({ getPrisma: vi.fn(async () => prisma) }));

const { mockCheckModel, mockCounts, mockOrgAccess } = vi.hoisted(() => ({
  mockCheckModel: vi.fn(),
  mockCounts: vi.fn(),
  mockOrgAccess: vi.fn(),
}));
vi.mock(
  "../../services/access-control/access-control-service.js",
  async (orig) => ({
    ...(await orig<Record<string, unknown>>()),
    checkThreatModelAccess: mockCheckModel,
    checkOrganizationAccess: mockOrgAccess,
  }),
);
vi.mock("../../services/redis-collaboration.js", () => ({
  getActiveUserCounts: mockCounts,
}));

async function app(register: (f: ReturnType<typeof Fastify>) => Promise<void>) {
  const f = Fastify();
  f.addHook("preHandler", async (request) => {
    request.authUser = caller;
  });
  await register(f);
  await f.ready();
  return f;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/presence", () => {
  it("only counts models the caller can access", async () => {
    const { presenceRoutes } = await import("../presence.js");
    const f = await app(async (s) => presenceRoutes(s));
    mockCheckModel.mockImplementation(async (_u: string, id: string) => ({
      hasAccess: id === "mine",
    }));
    mockCounts.mockImplementation(async (ids: string[]) =>
      Object.fromEntries(ids.map((id) => [id, 2])),
    );

    const res = await f.inject({
      method: "GET",
      url: "/api/presence?modelIds=mine,theirs",
    });

    expect(res.statusCode).toBe(200);
    expect(mockCounts).toHaveBeenCalledWith(["mine"]);
    expect(res.json().data).toEqual({ mine: 2 });
  });
});

describe("GET /api/v1/model-templates/categories", () => {
  it("counts only public templates and the caller's ACTIVE orgs' templates", async () => {
    const { listRoutes } = await import("../v1/model-templates/list-routes.js");
    const f = await app(async (s) => {
      await s.register(listRoutes, { prefix: "/api/v1" });
    });
    prisma.membership.findMany.mockResolvedValue([{ organizationId: "org-a" }]);
    prisma.modelTemplate.groupBy.mockResolvedValue([]);

    await f.inject({
      method: "GET",
      url: "/api/v1/model-templates/categories",
    });

    const where = prisma.modelTemplate.groupBy.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { organizationId: { in: ["org-a"] } },
      { isPublic: true },
    ]);
  });
});

describe("GET /api/v1/risk-frameworks/:frameworkId/presets", () => {
  it("answers 404 for another org's framework", async () => {
    const { frameworkRoutes } = await import(
      "../v1/risk-scoring/framework-routes.js"
    );
    const f = await app(async (s) => {
      await s.register(frameworkRoutes, { prefix: "/api/v1" });
    });
    prisma.riskFramework.findUnique.mockResolvedValue({
      id: "fw",
      type: "CVSS",
      organizationId: "org-b",
    });
    mockOrgAccess.mockResolvedValue({
      hasAccess: false,
      permissions: [],
      isGuest: false,
    });

    const res = await f.inject({
      method: "GET",
      url: "/api/v1/risk-frameworks/fw/presets",
    });

    expect(res.statusCode).toBe(404);
  });
});
