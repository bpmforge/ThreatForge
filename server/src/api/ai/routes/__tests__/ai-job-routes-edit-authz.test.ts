/**
 * AI routes that queue jobs writing to the model (SUGGEST_THREATS persists
 * threats, REFRESH_MITIGATIONS rewrites mitigations, ATTACK_TREE spends the
 * org's budget) and the synthesize routes only checked view access, so an org
 * VIEWER or guest viewer could rewrite the model and spend AI budget. They
 * now need edit; no access is a 404 like a missing model.
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
  threatModel: {
    findUnique: vi.fn(async () => ({
      id: "m1",
      projectId: "p1",
      canvasState: "{}",
      project: {
        organizationId: "o1",
        organization: { id: "o1", aiSettings: null },
      },
    })),
  },
  aiJob: {
    create: vi.fn(async () => ({ id: "job1" })),
    findFirst: vi.fn(async () => null),
    update: vi.fn(),
  },
  organization: { findUnique: vi.fn(async () => ({ aiSettings: null })) },
  threat: { findMany: vi.fn(async () => []) },
};
const enqueueAiJob = vi.fn(async () => undefined);

vi.mock("../../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../../../jobs/ai-queue.js", () => ({
  enqueueAiJob,
  runJobInBackground: vi.fn(),
}));
vi.mock("../../../../services/ai/spend-guard.js", async (orig) => ({
  ...(await orig<object>()),
  replyIfOverSpendCap: vi.fn(async () => false),
  assertWithinSpendCap: vi.fn(),
}));
vi.mock(
  "../../../../services/access-control/access-control-service.js",
  async () =>
    (await import("../../../../test/helpers/access-control-mock.js"))
      .accessControlModule,
);

const { modelGrants, resetGrants } = await import(
  "../../../../test/helpers/access-control-mock.js"
);
const { agenticAnalysisRoutes } = await import("../agentic-analysis.js");
const { expertAnalysisRoutes } = await import("../expert-analysis.js");
const { suggestionRoutes } = await import("../suggestions.js");
const { attackTreeRoutes } = await import("../attack-tree.js");
const { synthesizeRoutes } = await import("../synthesize.js");
const { synthesizeHLARoutes } = await import("../synthesize-hla.js");

const m = "/api/threat-models/m1/ai";
const routes = [
  `${m}/agentic-analysis?async=true`,
  `${m}/micro-analysis`,
  `${m}/refresh-mitigations`,
  `${m}/expert-analysis?async=true`,
  `${m}/suggest-threats?async=true`,
  `${m}/attack-tree?async=true`,
  `${m}/synthesize`,
  `${m}/synthesize-hla`,
];

describe("AI job routes need edit", () => {
  let app: FastifyInstance;
  const savedRedis = process.env.REDIS_URL;

  beforeAll(async () => {
    process.env.REDIS_URL = "redis://test";
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    for (const r of [
      agenticAnalysisRoutes,
      expertAnalysisRoutes,
      suggestionRoutes,
      attackTreeRoutes,
      synthesizeRoutes,
      synthesizeHLARoutes,
    ]) {
      await app.register(r);
    }
    await app.ready();
  });

  afterAll(async () => {
    if (savedRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = savedRedis;
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetGrants();
  });

  const post = (url: string) =>
    app.inject({
      method: "POST",
      url,
      payload: { componentId: "c1", threatName: "t" },
    });

  for (const url of routes) {
    it(`POST ${url}: 404 without access`, async () => {
      expect((await post(url)).statusCode).toBe(404);
      expect(enqueueAiJob).not.toHaveBeenCalled();
    });

    it(`POST ${url}: 403 for a viewer and a guest viewer, nothing queued`, async () => {
      for (const grant of [
        { role: "VIEWER" as const },
        { role: "VIEWER" as const, guest: true },
      ]) {
        modelGrants.set("m1", grant);
        expect((await post(url)).statusCode).toBe(403);
      }
      expect(enqueueAiJob).not.toHaveBeenCalled();
      expect(mockPrisma.aiJob.create).not.toHaveBeenCalled();
    });

    it(`POST ${url}: an editor gets past authorization`, async () => {
      modelGrants.set("m1", { role: "EDITOR", organizationId: "o1" });
      expect([403, 404]).not.toContain((await post(url)).statusCode);
    });
  }
});
