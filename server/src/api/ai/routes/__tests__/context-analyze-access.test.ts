/**
 * POST /api/ai/context-analyze loaded the body modelId's organization AI
 * settings (provider + key) and ran the LLM pipeline with them, without
 * checking the caller can access that model — any signed-in user could
 * spend another org's AI provider.
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

const mockCanAccess = vi.fn();
const mockPrisma = {
  threatModel: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn().mockResolvedValue(null) },
};
const mockPipeline = vi.fn();

vi.mock("../../../threat-models/helpers.js", () => ({
  canEditThreatModel: mockCanAccess,
}));
vi.mock("../../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock(
  "../../../../services/threat-generation/context-aware-pipeline.js",
  () => ({ runContextAwarePipeline: mockPipeline }),
);

const { contextAnalyzeRoutes } = await import("../context-analyze.js");

describe("context-analyze authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "attacker", email: "a@x.test", name: "A" };
    });
    await app.register(contextAnalyzeRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.threatModel.findUnique.mockResolvedValue({
      project: { organization: { id: "victim-org", aiSettings: null } },
    });
    mockPipeline.mockResolvedValue({
      findings: [],
      ruleBasedThreats: [],
      research: { owasp: [], cwes: [], complianceRequirements: [], cves: [] },
      analysisUsed: "rule-based",
      duration: 1,
    });
  });

  const analyze = (modelId?: string) =>
    app.inject({
      method: "POST",
      url: "/api/ai/context-analyze",
      payload: {
        modelId,
        component: { id: "c1", type: "database", name: "DB" },
      },
    });

  it("refuses a model the caller cannot access, before loading its AI settings", async () => {
    mockCanAccess.mockResolvedValue(false);

    const res = await analyze("victim-model");

    expect(res.statusCode).toBe(403);
    expect(mockCanAccess).toHaveBeenCalledWith("attacker", "victim-model");
    expect(mockPrisma.threatModel.findUnique).not.toHaveBeenCalled();
    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it("requires a modelId", async () => {
    const res = await analyze(undefined);
    expect(res.statusCode).toBe(400);
    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it("runs for a caller with access", async () => {
    mockCanAccess.mockResolvedValue(true);
    const res = await analyze("m1");
    expect(res.statusCode).toBe(200);
    expect(mockPipeline).toHaveBeenCalled();
  });
});
