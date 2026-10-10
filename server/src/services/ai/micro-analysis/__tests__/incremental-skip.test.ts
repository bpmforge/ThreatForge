/**
 * Wave B — Incremental Component Analysis Tests
 *
 * Unit tests for buildSkipSet and integration tests confirming that
 * runMicroAnalysis skips unchanged components and reports skippedComponentCount.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildSkipSet, runMicroAnalysis } from "../pipeline.js";
import type { ThreatModelContext } from "../../../../types/ai.js";

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockComponentFindMany = vi.fn();
const mockThreatFindMany = vi.fn();
const mockThreatCreate = vi.fn();
const mockThreatUpdate = vi.fn();
const mockComponentUpdate = vi.fn();

const mockPrisma = {
  component: {
    findMany: mockComponentFindMany,
    update: mockComponentUpdate,
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
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

// Silence modules that pull in heavy deps
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

vi.mock("../../../threat-review/review-service.js", () => ({
  persistAIThreats: vi
    .fn()
    .mockResolvedValue({ created: 0, updated: 0, skipped: 0 }),
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

// ---------------------------------------------------------------------------
// buildSkipSet unit tests
// ---------------------------------------------------------------------------

describe("buildSkipSet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.threatModel.findUnique.mockResolvedValue({ id: "model-1" });
  });

  it("returns nodeId when hash is set AND analyzedAt is set", async () => {
    mockComponentFindMany.mockResolvedValueOnce([
      {
        nodeId: "node-1",
        analysisHash: "abc123",
        analyzedAt: new Date(),
      },
    ]);

    const result = await buildSkipSet("model-1", false);

    expect(result.size).toBe(1);
    expect(result.has("node-1")).toBe(true);
  });

  it("does not skip when hash is set but analyzedAt is null", async () => {
    mockComponentFindMany.mockResolvedValueOnce([
      {
        nodeId: "node-1",
        analysisHash: "abc123",
        analyzedAt: null,
      },
    ]);

    const result = await buildSkipSet("model-1", false);

    expect(result.size).toBe(0);
  });

  it("returns empty set when force=true, even if all components are clean", async () => {
    mockComponentFindMany.mockResolvedValueOnce([
      { nodeId: "node-1", analysisHash: "abc", analyzedAt: new Date() },
      { nodeId: "node-2", analysisHash: "def", analyzedAt: new Date() },
      { nodeId: "node-3", analysisHash: "ghi", analyzedAt: new Date() },
    ]);

    const result = await buildSkipSet("model-1", true);

    expect(result.size).toBe(0);
    // getPrisma should not even be called when force=true
    expect(mockComponentFindMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// runMicroAnalysis integration test
// ---------------------------------------------------------------------------

describe("runMicroAnalysis — incremental skip", () => {
  const aiCall = vi.fn().mockResolvedValue(
    JSON.stringify({
      threats: [
        {
          name: "Dirty Threat",
          description: "Found on dirty component",
          category: "TAMPERING",
          severity: "HIGH",
          confidence: 0.85,
          cweIds: [],
          owaspIds: [],
          evidence: {},
          mitigations: [],
          mitigation: { description: "", effort: "low", effectiveness: "0.5" },
        },
      ],
      confidence: 0.85,
      coverageGaps: [],
    }),
  );

  const context: ThreatModelContext = {
    threatModelId: "model-1",
    components: [
      {
        id: "comp-clean-1",
        name: "Clean Component 1",
        type: "SERVICE",
        properties: {},
      },
      {
        id: "comp-clean-2",
        name: "Clean Component 2",
        type: "SERVICE",
        properties: {},
      },
      {
        id: "comp-dirty",
        name: "Dirty Component",
        type: "SERVICE",
        properties: {},
      },
    ],
    connections: [],
    sequenceFlows: [],
    requirements: [],
  } as unknown as ThreatModelContext;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the once-queue so unconsumed values from prior tests don't bleed in
    mockComponentFindMany.mockReset();

    // buildSkipSet query: 2 clean, 1 dirty
    mockComponentFindMany
      .mockResolvedValueOnce([
        {
          nodeId: "node-clean-1",
          analysisHash: "hash1",
          analyzedAt: new Date(),
        },
        {
          nodeId: "node-clean-2",
          analysisHash: "hash2",
          analyzedAt: new Date(),
        },
        { nodeId: "node-dirty", analysisHash: null, analyzedAt: null },
      ])
      // dbIdToNodeId query
      .mockResolvedValueOnce([
        { id: "comp-clean-1", nodeId: "node-clean-1" },
        { id: "comp-clean-2", nodeId: "node-clean-2" },
        { id: "comp-dirty", nodeId: "node-dirty" },
      ]);

    mockThreatFindMany.mockResolvedValue([]);
    mockThreatCreate.mockResolvedValue({ id: "t-1" });
    mockComponentUpdate.mockResolvedValue({});
  });

  it("only calls aiCall for dirty component and reports skippedComponentCount=2", async () => {
    const result = await runMicroAnalysis(
      context,
      aiCall,
      { methodologies: ["stride"] },
      { threatModelId: "model-1", userId: "user-1" },
    );

    // aiCall should be invoked for the dirty component (6 categories × stride)
    // but NOT for the 2 clean components
    const callCount = aiCall.mock.calls.length;
    expect(callCount).toBeGreaterThan(0);
    expect(callCount).toBeLessThan(context.components.length * 6);

    expect(result.summary.skippedComponentCount).toBe(2);
  });

  /**
   * The wall-clock bound.
   *
   * The assertion that matters is that this RESOLVES. A throwing deadline
   * would take processAiJob's FAILED path, where cleanupSessionThreats deletes
   * every AI_SUGGESTED/PENDING row carrying the session id — and components are
   * stream-persisted as they finish. Throwing would therefore destroy the
   * partial results the bound exists to preserve.
   */
  it("stops the loop on a spent budget WITHOUT throwing, and says so", async () => {
    const result = await runMicroAnalysis(
      context,
      aiCall,
      { methodologies: ["stride"], deadlineAt: Date.now() - 1 },
      { threatModelId: "model-1", userId: "user-1" },
    );

    // Resolved, not rejected — partial results survive.
    expect(result.summary.deadlineStopped).toBe(true);
    // Budget was already spent, so no provider call was made.
    expect(aiCall.mock.calls.length).toBe(0);
  });

  /**
   * An absent deadline no longer means unbounded. The loop defaults its own
   * budget, so a caller that forgets to pass one still gets a bound — that
   * omission is exactly why B8 shipped inert. The default budget is 25 min, so a
   * normal run is unaffected.
   */
  it("still completes normally when no deadline is supplied — the default budget is not hit", async () => {
    const result = await runMicroAnalysis(
      context,
      aiCall,
      { methodologies: ["stride"] },
      { threatModelId: "model-1", userId: "user-1" },
    );

    expect(result.summary.deadlineStopped).toBeUndefined();
    expect(aiCall.mock.calls.length).toBeGreaterThan(0);
  });
});
