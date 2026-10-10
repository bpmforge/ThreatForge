/**
 * AI rescore (rewrites threat severities), sequence generation (writes
 * diagrams, spends AI budget) and model duplicate (creates a model in the
 * project) only checked view access. Rescore and generation need edit;
 * duplicating creates a model in the project, so it needs an org member with
 * edit — a guest editor's grant covers one model, not the project.
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
  threatModel: { findUnique: vi.fn(), create: vi.fn() },
  threat: { findMany: vi.fn(), update: vi.fn() },
  sequenceDiagram: { create: vi.fn() },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../ai/helpers.js", async (orig) => ({
  ...(await orig<typeof import("../ai/helpers.js")>()),
  getAIServiceForModel: vi.fn(async () => null),
}));
vi.mock(
  "../../services/access-control/access-control-service.js",
  async () =>
    (await import("../../test/helpers/access-control-mock.js"))
      .accessControlModule,
);

const { modelGrants, resetGrants } = await import(
  "../../test/helpers/access-control-mock.js"
);
const { rescoreRoutes } = await import("../ai/routes/rescore.js");
const { generateRoutes } = await import(
  "../sequence-diagrams/routes/generate.js"
);
const { canvasRoutes } = await import("../threat-models/routes/canvas.js");

const m = "/api/threat-models/m1";
const routes = [
  { url: `${m}/ai/rescore`, payload: {} },
  { url: `${m}/sequences/generate`, payload: { description: "login flow" } },
  { url: `${m}/sequences/auto-generate`, payload: {} },
  { url: `${m}/duplicate`, payload: {} },
];

describe("AI rescore / sequence generation / duplicate authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(rescoreRoutes);
    await app.register(generateRoutes);
    await app.register(canvasRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    resetGrants();
    mockPrisma.threatModel.findUnique.mockResolvedValue({
      id: "m1",
      name: "M",
      canvasState: "{}",
      projectId: "p1",
    });
    mockPrisma.threatModel.create.mockResolvedValue({
      id: "m2",
      canvasState: "{}",
    });
    mockPrisma.threat.findMany.mockResolvedValue([]);
  });

  for (const r of routes) {
    it(`POST ${r.url}: 404 without access`, async () => {
      const res = await app.inject({ method: "POST", ...r });
      expect(res.statusCode).toBe(404);
    });

    it(`POST ${r.url}: 403 for a viewer and a guest viewer`, async () => {
      for (const grant of [
        { role: "VIEWER" as const },
        { role: "VIEWER" as const, guest: true },
      ]) {
        modelGrants.set("m1", grant);
        const res = await app.inject({ method: "POST", ...r });
        expect(res.statusCode).toBe(403);
      }
      expect(mockPrisma.threat.update).not.toHaveBeenCalled();
      expect(mockPrisma.threatModel.create).not.toHaveBeenCalled();
    });

    it(`POST ${r.url}: an org editor gets past authorization`, async () => {
      modelGrants.set("m1", { role: "EDITOR" });
      const res = await app.inject({ method: "POST", ...r });
      expect([403, 404]).not.toContain(res.statusCode);
    });
  }

  it("duplicate: 403 for a guest editor", async () => {
    modelGrants.set("m1", { role: "EDITOR", guest: true });
    const res = await app.inject({ method: "POST", url: `${m}/duplicate` });
    expect(res.statusCode).toBe(403);
    expect(mockPrisma.threatModel.create).not.toHaveBeenCalled();
  });
});
