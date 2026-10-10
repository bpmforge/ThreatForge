/**
 * Transient provider failure must not become permanent silent recall loss.
 *
 * Two pipeline-level contracts, tested against the mock-prisma harness
 * (pattern lifted from incremental-skip.test.ts):
 *
 * 1. A component whose units all failed must NOT get `analyzedAt`
 *    stamped, so buildSkipSet does not skip it forever on the next run.
 * 2. A provider that fails on every call for the whole run must make
 *    runMicroAnalysis reject with a typed, recognisable error (code
 *    ALL_UNITS_FAILED) so the caller (ai-worker.ts) can mark the job
 *    FAILED — instead of silently completing with zero threats.
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

const context: ThreatModelContext = {
  threatModelId: "model-1",
  components: [
    {
      id: "comp-1",
      name: "Component 1",
      type: "SERVICE",
      properties: {},
    },
  ],
  connections: [],
  sequenceFlows: [],
  requirements: [],
} as unknown as ThreatModelContext;

describe("runMicroAnalysis — provider always fails", () => {
  const alwaysFailingAiCall = vi
    .fn()
    .mockRejectedValue(new Error("ECONNREFUSED"));

  beforeEach(() => {
    vi.clearAllMocks();
    alwaysFailingAiCall.mockClear();
    alwaysFailingAiCall.mockRejectedValue(new Error("ECONNREFUSED"));
    mockPersistAIThreats.mockResolvedValue({
      created: 0,
      updated: 0,
      skipped: 0,
    });

    mockComponentFindMany.mockReset();
    // buildSkipSet query — component not previously analyzed.
    mockComponentFindMany
      .mockResolvedValueOnce([
        { nodeId: "node-1", analysisHash: null, analyzedAt: null },
      ])
      // dbIdToNodeId query
      .mockResolvedValueOnce([{ id: "comp-1", nodeId: "node-1" }]);
    mockThreatFindMany.mockResolvedValue([]);
    mockThreatCreate.mockResolvedValue({ id: "t-1" });
  });

  it("rejects with a typed ALL_UNITS_FAILED error instead of completing with zero threats", async () => {
    await expect(
      runMicroAnalysis(
        context,
        alwaysFailingAiCall,
        { methodologies: ["stride"], retrySleep: async () => {} },
        { threatModelId: "model-1", userId: "user-1", sessionId: "job-1" },
      ),
    ).rejects.toMatchObject({ code: "ALL_UNITS_FAILED" });
  });

  it("does NOT stamp analyzedAt on the failed component (R5 — must be re-analysed next run)", async () => {
    await expect(
      runMicroAnalysis(
        context,
        alwaysFailingAiCall,
        { methodologies: ["stride"], retrySleep: async () => {} },
        { threatModelId: "model-1", userId: "user-1", sessionId: "job-1" },
      ),
    ).rejects.toThrow();

    expect(mockComponentUpdateMany).not.toHaveBeenCalled();
  });

  it("never calls persistAIThreats with new threats when every unit failed (nothing to wipe)", async () => {
    await expect(
      runMicroAnalysis(
        context,
        alwaysFailingAiCall,
        { methodologies: ["stride"], retrySleep: async () => {} },
        { threatModelId: "model-1", userId: "user-1", sessionId: "job-1" },
      ),
    ).rejects.toThrow();

    expect(mockPersistAIThreats).not.toHaveBeenCalled();
  });
});
