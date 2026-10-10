/**
 * v1 Data API tenant isolation: a signed-in user only sees threat models in
 * orgs they are an active member of (or hold a guest grant on).
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

const mockPrisma = {
  threatModel: { findMany: vi.fn(), findUnique: vi.fn() },
};
const checkThreatModelAccess = vi.fn();

vi.mock("../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../../services/access-control/access-control-service.js", () => ({
  checkThreatModelAccess: (...args: unknown[]) =>
    checkThreatModelAccess(...args),
}));

const { dataApiRoutes } = await import("../data-api.js");

describe("v1 data API authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "attacker", email: "a@x.test", name: "A" };
    });
    await app.register(dataApiRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.threatModel.findMany.mockResolvedValue([]);
  });

  it("lists only models in orgs the caller is an active member of", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/threat-models",
    });

    expect(res.statusCode).toBe(200);
    const where = mockPrisma.threatModel.findMany.mock.calls[0][0].where;
    expect(where.deletedAt).toBeNull();
    expect(where.project.organization.memberships).toEqual({
      some: { userId: "attacker", status: "ACTIVE" },
    });
  });

  it.each([
    "/api/v1/threat-models/victim-model/threats",
    "/api/v1/threat-models/victim-model/compliance/soc2",
    "/api/v1/threat-models/victim-model/risk-summary",
  ])("returns 404 for %s when the caller has no access", async (url) => {
    checkThreatModelAccess.mockResolvedValue({
      hasAccess: false,
      permissions: [],
    });

    const res = await app.inject({ method: "GET", url });

    expect(res.statusCode).toBe(404);
    expect(checkThreatModelAccess).toHaveBeenCalledWith(
      "attacker",
      "victim-model",
    );
    expect(mockPrisma.threatModel.findUnique).not.toHaveBeenCalled();
  });
});
