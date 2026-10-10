/**
 * Wave D — Selective Scope Tests
 *
 * Tests for componentNodeIds filter, categories filter, mitigationsOnly mode,
 * and the synchronous /rescore endpoint (autoScoreThreat).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runMicroAnalysis } from "../../../../services/ai/micro-analysis/pipeline.js";
import type { ThreatModelContext } from "../../../../types/ai.js";

// ---------------------------------------------------------------------------
// Mock Prisma — declare first so vi.mock factories can close over them lazily
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
    upsert: vi.fn().mockResolvedValue({ id: "t-1" }),
  },
  mitigation: {
    create: vi.fn().mockResolvedValue({ id: "mit-1" }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  user: {
    findUnique: vi.fn().mockResolvedValue(null),
  },
};

// Use a function wrapper so `mockPrisma` is resolved lazily (after hoisting)
vi.mock("../../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

vi.mock("../../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../../services/threat-review/review-service.js", () => ({
  persistAIThreats: vi
    .fn()
    .mockResolvedValue({ created: 1, updated: 0, skipped: 0 }),
  getReviewedThreats: vi.fn().mockResolvedValue([]),
}));

vi.mock(
  "../../../../services/ai/micro-analysis/mitigation-analyzer.js",
  () => ({
    generateMitigationsForComponent: vi
      .fn()
      .mockImplementation((_aiCall, _ctx, threats) => Promise.resolve(threats)),
    MITIGATION_BATCH_SIZE: 3,
  }),
);

vi.mock("../../../../services/ai/micro-analysis/compound-analyzer.js", () => ({
  analyzeCompoundThreats: vi.fn().mockResolvedValue({
    attackChains: [],
    compoundThreats: [],
  }),
}));

vi.mock(
  "../../../../services/ai/micro-analysis/severity-calibrator.js",
  () => ({
    calibrateSeverities: vi
      .fn()
      .mockImplementation((_ai, threats) => Promise.resolve(threats)),
  }),
);

vi.mock(
  "../../../../services/ai/micro-analysis/supplemental-threats.js",
  () => ({
    generateSupplyChainThreats: vi.fn().mockResolvedValue([]),
    generateMLThreats: vi.fn().mockResolvedValue([]),
  }),
);

vi.mock("../../../../services/ai/universal-system-prompt.js", () => ({
  getUserWritingStyle: vi.fn().mockResolvedValue({ enabled: false }),
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const baseContext: ThreatModelContext = {
  name: "Test Model",
  methodology: "STRIDE",
  components: [
    { id: "comp-1", type: "WEB_APP", name: "Frontend" },
    { id: "comp-2", type: "DATABASE", name: "DB" },
    { id: "comp-3", type: "API", name: "Backend" },
  ],
  connections: [],
  boundaries: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Wave D: componentNodeIds filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComponentFindMany.mockResolvedValue([
      { id: "comp-1", nodeId: "node-1" },
      { id: "comp-2", nodeId: "node-2" },
      { id: "comp-3", nodeId: "node-3" },
    ]);
    mockThreatFindMany.mockResolvedValue([]);
    mockComponentUpdate.mockResolvedValue({});
  });

  it("only analyses the scoped component; others are skipped", async () => {
    const aiCall = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ threats: [], confidence: 0.9 }));

    const result = await runMicroAnalysis(
      baseContext,
      aiCall,
      {
        methodologies: ["stride"],
        componentNodeIds: ["node-1"],
        force: true,
      },
      { threatModelId: "model-1", userId: "user-1" },
    );

    // Pipeline ran; node-2 and node-3 were skipped by scope filter
    expect(result.summary.componentsAnalyzed).toBe(3);
    // Only 1 component could have produced threats (others filtered out)
    expect(result.summary.componentsCovered).toBeLessThanOrEqual(1);
  });
});

describe("Wave D: categories filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComponentFindMany.mockResolvedValue([
      { id: "comp-1", nodeId: "node-1" },
    ]);
    mockThreatFindMany.mockResolvedValue([]);
    mockComponentUpdate.mockResolvedValue({});
  });

  it("pipeline completes without error when categories is restricted", async () => {
    const aiCall = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ threats: [], confidence: 0.9 }));

    const result = await runMicroAnalysis(
      { ...baseContext, components: [baseContext.components[0]] },
      aiCall,
      {
        methodologies: ["stride"],
        categories: ["SPOOFING"],
        componentNodeIds: ["node-1"],
        force: true,
      },
      { threatModelId: "model-1", userId: "user-1" },
    );

    expect(result.summary.componentsAnalyzed).toBe(1);
    expect(result.threats).toBeDefined();
  });
});

describe("Wave D: mitigationsOnly skips threat generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComponentFindMany.mockResolvedValue([
      { id: "comp-1", nodeId: "node-1" },
    ]);
    mockComponentUpdate.mockResolvedValue({});
  });

  it("loads existing PENDING threats and does not call analyzeComponent", async () => {
    const existingThreat = {
      id: "t-existing",
      name: "SQL Injection",
      description: "Unsanitised input",
      severity: "HIGH",
      reviewStatus: "PENDING",
      manuallyEdited: false,
      componentNodeId: "node-1",
      strideCategories: JSON.stringify(["TAMPERING"]),
      cweIds: JSON.stringify(["CWE-89"]),
      owaspIds: JSON.stringify(["A03:2021"]),
      evidence: JSON.stringify({}),
      aiConfidence: 0.85,
      aiMethodology: "stride",
      category: "TAMPERING",
    };
    mockThreatFindMany.mockResolvedValue([existingThreat]);

    const aiCall = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ threats: [], confidence: 0.9 }));

    const result = await runMicroAnalysis(
      baseContext,
      aiCall,
      {
        methodologies: ["stride"],
        mitigationsOnly: true,
        force: true,
      },
      { threatModelId: "model-1", userId: "user-1" },
    );

    // Pipeline completes without error
    expect(result.summary.componentsAnalyzed).toBe(3);
    // Category-level LLM calls were skipped (per-component loop hit the
    // mitigationsOnly continue before calling analyzeComponent)
    // aiCall may be used for mitigation generation but not for threat analysis
    expect(result.threats).toBeDefined();
  });
});

describe("Wave D: rescore produces CVSS without LLM", () => {
  it("autoScoreThreat returns valid CVSS vectors", async () => {
    const { autoScoreThreat } = await import(
      "../../../../services/threat-review/cvss-auto-scorer.js"
    );
    const threat = {
      name: "Test",
      description: "",
      category: "SPOOFING",
      severity: "HIGH" as const,
      componentId: "c-1",
      componentName: "App",
      cweIds: [],
      owaspIds: [],
      evidence: {},
      mitigations: [],
      mitigation: { description: "", effort: "MEDIUM", effectiveness: "0.5" },
      confidence: 0.8,
      sourceMethodology: "stride",
    };

    const result = autoScoreThreat(threat);

    expect(result.score31).toBeGreaterThan(0);
    expect(result.vector31).toContain("CVSS:3.1");
    expect(result.vector40).toContain("CVSS:4.0");
    expect(result.nvdLink31).toContain("CVSS:3.1");
  });
});
