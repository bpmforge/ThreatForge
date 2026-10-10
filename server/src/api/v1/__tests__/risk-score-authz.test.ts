/**
 * POST /risk-scores/calculate let any ACTIVE org member (viewers included)
 * write a threat's risk score, and used any frameworkId — including another
 * organization's custom framework. Scoring is a write on the threat's model
 * (edit), and the framework must be a global one or belong to the threat's
 * organization. No access to the threat is a 404, like a missing threat.
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
import { createFakePrisma } from "../../../test/helpers/fake-prisma.js";

const prisma = createFakePrisma({
  threat: [
    {
      id: "t1",
      threatModelId: "m1",
      threatModel: { project: { organizationId: "o1" } },
    },
  ],
  riskFramework: [
    { id: "fw-global", organizationId: null, type: "DREAD", name: "G" },
    { id: "fw-own", organizationId: "o1", type: "DREAD", name: "Own" },
    { id: "fw-victim", organizationId: "o2", type: "DREAD", name: "Theirs" },
  ],
  threatRiskScore: [],
});
prisma.threatRiskScore.upsert.mockImplementation(async () => ({
  id: "rs",
  threatId: "t1",
  frameworkId: "fw",
  calculatedAt: new Date(),
}));

vi.mock("../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(prisma)),
}));
vi.mock(
  "../../../services/access-control/access-control-service.js",
  async () =>
    (await import("../../../test/helpers/access-control-mock.js"))
      .accessControlModule,
);

const { modelGrants, orgRoles, resetGrants } = await import(
  "../../../test/helpers/access-control-mock.js"
);
const { scoreRoutes } = await import("../risk-scoring/score-routes.js");

const factors = {
  damage: 5,
  reproducibility: 5,
  exploitability: 5,
  affectedUsers: 5,
  discoverability: 5,
};
const calc = (frameworkId: string) => ({
  method: "POST" as const,
  url: "/risk-scores/calculate",
  payload: { threatId: "t1", frameworkId, factors },
});

describe("risk score calculation authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(scoreRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    resetGrants();
  });

  it("404 without access to the threat's model", async () => {
    const res = await app.inject(calc("fw-own"));
    expect(res.statusCode).toBe(404);
    expect(prisma.threatRiskScore.upsert).not.toHaveBeenCalled();
  });

  it("403 for a viewer", async () => {
    modelGrants.set("m1", { role: "VIEWER", organizationId: "o1" });
    orgRoles.set("o1", "VIEWER");
    const res = await app.inject(calc("fw-own"));
    expect(res.statusCode).toBe(403);
    expect(prisma.threatRiskScore.upsert).not.toHaveBeenCalled();
  });

  it("another organization's framework is a 404", async () => {
    modelGrants.set("m1", { role: "EDITOR", organizationId: "o1" });
    orgRoles.set("o1", "EDITOR");
    const res = await app.inject(calc("fw-victim"));
    expect(res.statusCode).toBe(404);
    expect(prisma.threatRiskScore.upsert).not.toHaveBeenCalled();
  });

  it("an editor can score with a global or own-org framework", async () => {
    modelGrants.set("m1", { role: "EDITOR", organizationId: "o1" });
    orgRoles.set("o1", "EDITOR");
    expect((await app.inject(calc("fw-global"))).statusCode).toBe(200);
    expect((await app.inject(calc("fw-own"))).statusCode).toBe(200);
  });

  it("GET scores: 404 without access", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/threats/t1/risk-scores",
    });
    expect(res.statusCode).toBe(404);
  });

  it("a missing threat and an unreachable one get the same 404", async () => {
    const unreachable = await app.inject(calc("fw-own"));
    const missing = await app.inject({
      ...calc("fw-own"),
      payload: { threatId: "nope", frameworkId: "fw-own", factors },
    });
    // Compare the error, not the whole body: it carries a per-request id.
    const err = (r: { body: string }) => JSON.parse(r.body).error;
    expect(missing.statusCode).toBe(404);
    expect(err(missing)).toBe(err(unreachable));
    const getMissing = await app.inject({
      method: "GET",
      url: "/threats/nope/risk-scores",
    });
    const getUnreachable = await app.inject({
      method: "GET",
      url: "/threats/t1/risk-scores",
    });
    expect(err(getMissing)).toBe(err(getUnreachable));
  });
});
