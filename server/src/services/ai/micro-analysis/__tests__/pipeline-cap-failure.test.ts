/**
 * Hitting the cap must never wipe already-persisted threats.
 *
 * Two pipeline-level contracts, tested against the mock-prisma harness
 * (pattern lifted from pipeline-retry-failure.test.ts / incremental-skip.test.ts):
 *
 * 1. PIPELINE_COMPONENT_CAP (assertUnderCap in pipeline.ts): when one
 *    component's emissions for this run cross the cap, the loop must abort
 *    with a typed, recognisable error (code COMPONENT_CAP_EXCEEDED) WITHOUT
 *    ever calling persistAIThreats for that component's over-cap batch —
 *    and must not have touched threats already streamed for earlier
 *    components this run.
 * 2. review-service.ts's MAX_THREATS_PER_COMPONENT_PER_RUN returns a
 *    success-shaped { created: 0, updated: 0, skipped: n, capped: true }.
 *    The streaming-persist caller in pipeline.ts must detect `capped` and
 *    record it as a failure for that component (parseFailures + no
 *    analyzedAt stamp) instead of silently treating the run as COMPLETED.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runMicroAnalysis } from "../pipeline.js";
import type { ThreatModelContext } from "../../../../types/ai.js";

const mockComponentFindMany = vi.fn();
const mockComponentUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
const mockThreatFindMany = vi.fn();
const mockThreatCreate = vi.fn();
const mockThreatUpdate = vi.fn();

const mockPrisma = {
  component: {
    findMany: mockComponentFindMany,
    updateMany: mockComponentUpdateMany,
  },
  threatModel: {
    findUnique: vi.fn().mockResolvedValue({ id: "model-1" }),
  },
  threat: {
    findMany: mockThreatFindMany,
    create: mockThreatCreate,
    update: mockThreatUpdate,
  },
  mitigation: {
    create: vi.fn().mockResolvedValue({ id: "mit-1" }),
  },
  user: {
    findUnique: vi.fn().mockResolvedValue(null),
  },
};

vi.mock("../../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

vi.mock("../../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../supplemental-threats.js", () => ({
  generateSupplyChainThreats: vi.fn().mockResolvedValue([]),
  generateMLThreats: vi.fn().mockResolvedValue([]),
}));

vi.mock("../compound-analyzer.js", () => ({
  analyzeCompoundThreats: vi
    .fn()
    .mockResolvedValue({ attackChains: [], compoundThreats: [] }),
}));

vi.mock("../severity-calibrator.js", () => ({
  calibrateSeverities: vi
    .fn()
    .mockImplementation((_ai, threats) => Promise.resolve(threats)),
}));

const mockPersistAIThreats = vi
  .fn()
  .mockResolvedValue({ created: 0, updated: 0, skipped: 0 });

vi.mock("../../../threat-review/review-service.js", () => ({
  persistAIThreats: (...args: unknown[]) => mockPersistAIThreats(...args),
  getReviewedThreats: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../universal-system-prompt.js", () => ({
  getUserWritingStyle: vi.fn().mockResolvedValue(null),
}));

vi.mock("../mitigation-analyzer.js", () => ({
  generateMitigationsForComponent: vi
    .fn()
    .mockImplementation((_ai, _comp, threats) => Promise.resolve(threats)),
  MITIGATION_BATCH_SIZE: 3,
}));

// Directly mock analyzeComponent so we control exactly how many threats
// each component "generates" per methodology call, independent of the
// category-analyzer's JSON-parsing internals.
const mockAnalyzeComponent = vi.fn();
vi.mock("../component-analyzer.js", () => ({
  analyzeComponent: (...args: unknown[]) => mockAnalyzeComponent(...args),
}));

function makeThreats(componentId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `Threat ${i}`,
    description: "d",
    category: "TAMPERING",
    severity: "HIGH" as const,
    componentId,
    componentName: componentId,
    cweIds: [],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "MEDIUM", effectiveness: "0.5" },
    confidence: 0.8,
    sourceMethodology: "stride",
  }));
}

const context: ThreatModelContext = {
  threatModelId: "model-1",
  components: [
    { id: "comp-1", name: "Component 1", type: "SERVICE", properties: {} },
    { id: "comp-2", name: "Component 2", type: "SERVICE", properties: {} },
  ],
  connections: [],
  sequenceFlows: [],
  requirements: [],
} as unknown as ThreatModelContext;

describe("runMicroAnalysis — pipeline component cap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistAIThreats.mockReset();
    mockPersistAIThreats.mockResolvedValue({
      created: 0,
      updated: 0,
      skipped: 0,
    });

    mockComponentFindMany.mockReset();
    mockComponentFindMany
      .mockResolvedValueOnce([
        { nodeId: "node-1", analysisHash: null, analyzedAt: null },
        { nodeId: "node-2", analysisHash: null, analyzedAt: null },
      ])
      .mockResolvedValueOnce([
        { id: "comp-1", nodeId: "node-1" },
        { id: "comp-2", nodeId: "node-2" },
      ]);
    mockThreatFindMany.mockResolvedValue([]);
    mockThreatCreate.mockResolvedValue({ id: "t-1" });

    // comp-1: a normal, well-under-cap batch — persists successfully.
    // comp-2: a single methodology call that alone blows past
    // PIPELINE_COMPONENT_CAP (40).
    mockAnalyzeComponent.mockImplementation(
      async (_aiCall: unknown, component: { id: string }) => {
        if (component.id === "comp-1") {
          return {
            threats: makeThreats("comp-1", 3),
            llmCalls: 1,
            parseFailures: [],
          };
        }
        return {
          threats: makeThreats("comp-2", 41),
          llmCalls: 1,
          parseFailures: [],
        };
      },
    );
  });

  it("rejects with a typed COMPONENT_CAP_EXCEEDED error", async () => {
    await expect(
      runMicroAnalysis(
        context,
        vi.fn(),
        { methodologies: ["stride"] },
        { threatModelId: "model-1", userId: "user-1", sessionId: "job-1" },
      ),
    ).rejects.toMatchObject({ code: "COMPONENT_CAP_EXCEEDED" });
  });

  it("keeps comp-1's threats persisted: never calls persistAIThreats for comp-2's over-cap batch", async () => {
    await expect(
      runMicroAnalysis(
        context,
        vi.fn(),
        { methodologies: ["stride"] },
        { threatModelId: "model-1", userId: "user-1", sessionId: "job-1" },
      ),
    ).rejects.toThrow();

    // comp-1's 3 threats were persisted before comp-2 blew the cap.
    expect(mockPersistAIThreats).toHaveBeenCalledTimes(1);
    const [, , persistedThreats] = mockPersistAIThreats.mock.calls[0];
    expect(persistedThreats).toHaveLength(3);
    expect(
      (persistedThreats as Array<{ componentId: string }>).every(
        (t) => t.componentId === "comp-1",
      ),
    ).toBe(true);
  });

  it("does not stamp analyzedAt on comp-2 (the loop aborted before reaching that point)", async () => {
    await expect(
      runMicroAnalysis(
        context,
        vi.fn(),
        { methodologies: ["stride"] },
        { threatModelId: "model-1", userId: "user-1", sessionId: "job-1" },
      ),
    ).rejects.toThrow();

    // comp-1 DID complete its loop iteration (stamped); comp-2 never
    // reached the stamp because assertUnderCap threw first.
    expect(mockComponentUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockComponentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ nodeId: "node-1" }),
      }),
    );
  });
});

describe("runMicroAnalysis — review-service cap surfaced (not silently COMPLETED)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistAIThreats.mockReset();

    mockComponentFindMany.mockReset();
    mockComponentFindMany
      .mockResolvedValueOnce([
        { nodeId: "node-1", analysisHash: null, analyzedAt: null },
      ])
      .mockResolvedValueOnce([{ id: "comp-1", nodeId: "node-1" }]);
    mockThreatFindMany.mockResolvedValue([]);
    mockThreatCreate.mockResolvedValue({ id: "t-1" });

    // Well under the pipeline's per-run emission cap (5 threats), but
    // review-service.ts's own MAX_THREATS_PER_COMPONENT_PER_RUN refuses the
    // batch anyway (e.g. combined with pre-existing threats on the row).
    mockAnalyzeComponent.mockResolvedValue({
      threats: makeThreats("comp-1", 5),
      llmCalls: 1,
      parseFailures: [],
    });
    mockPersistAIThreats.mockResolvedValue({
      created: 0,
      updated: 0,
      skipped: 5,
      capped: true,
    });
  });

  it("records the capped skip as a parseFailure instead of completing silently", async () => {
    const result = await runMicroAnalysis(
      context,
      vi.fn(),
      { methodologies: ["stride"] },
      { threatModelId: "model-1", userId: "user-1", sessionId: "job-1" },
    );

    expect(result.summary.parseFailures).toBeGreaterThan(0);
    expect(result.parseFailures.some((f) => f.stage === "component-cap")).toBe(
      true,
    );
  });

  it("does not stamp analyzedAt for the capped component (must retry next run)", async () => {
    await runMicroAnalysis(
      context,
      vi.fn(),
      { methodologies: ["stride"] },
      { threatModelId: "model-1", userId: "user-1", sessionId: "job-1" },
    );

    expect(mockComponentUpdateMany).not.toHaveBeenCalled();
  });
});
