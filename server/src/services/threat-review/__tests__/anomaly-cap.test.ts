/**
 * Anomaly cap tests (anomaly-2, anomaly-5).
 *
 * The anomaly cap has two layers:
 *
 * 1. Per-batch cap in persistAIThreats — catches single-call LLM
 *    hallucinations (e.g., one category call emits 41 threats).
 * 2. Per-run cap in pipeline.ts — catches the running total across all
 *    streaming calls in one pipeline execution. Tested separately in
 *    pipeline tests.
 *
 * This file covers layer 1. Specifically:
 *   anomaly-2: 41 threats for one component in one call writes NONE
 *   anomaly-5: the cap is batch-level — cumulative DB state is NOT consulted
 *
 * anomaly-5 is the subtle one. Streaming persist fires ~6 calls per
 * component with ~3 threats each. If the cap consulted DB totals, a
 * legitimate streaming run would hit it at the 14th threat. The cap MUST
 * only see what's in the current batch.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { persistAIThreats } from "../review-service.js";
import type { MicroThreat } from "../../ai/micro-analysis/types.js";

const mockThreatFindMany = vi.fn();
const mockThreatCreate = vi.fn();
const mockThreatUpdate = vi.fn();
const mockComponentFindMany = vi.fn();

const mockPrisma = {
  threatModel: { findUnique: vi.fn() },
  component: { findMany: mockComponentFindMany },
  threat: {
    findMany: mockThreatFindMany,
    create: mockThreatCreate,
    update: mockThreatUpdate,
  },
  mitigation: { create: vi.fn(), deleteMany: vi.fn() },
  requirement: { findFirst: vi.fn(), create: vi.fn() },
  mitigationRequirement: { create: vi.fn() },
};

vi.mock("../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

vi.mock("../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function makeThreat(name: string, componentId: string): MicroThreat {
  return {
    name,
    description: "Description",
    category: "TAMPERING",
    severity: "HIGH",
    componentId,
    componentName: "Test Component",
    cweIds: [],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "low", effectiveness: "0.5" },
    confidence: 0.8,
    sourceMethodology: "stride",
  };
}

describe("persistAIThreats — per-batch anomaly cap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.threatModel.findUnique.mockResolvedValue({ id: "model-1" });
    mockComponentFindMany.mockResolvedValue([
      { id: "comp-1", nodeId: "node-c1", analysisHash: "abc" },
    ]);
    mockThreatFindMany.mockResolvedValue([]);
    mockThreatCreate.mockResolvedValue({ id: "t-new" });
  });

  it("anomaly-2: 41 threats for one component writes NONE", async () => {
    const batch = Array.from({ length: 41 }, (_, i) =>
      makeThreat(`Threat ${i}`, "comp-1"),
    );

    const result = await persistAIThreats("model-1", "user-1", batch);

    // `capped: true` distinguishes "the whole batch was refused by
    // the anomaly cap" from an ordinary success-shaped { created: 0 } (e.g.
    // every threat matched an existing/reviewed one) — callers such as
    // micro-analysis/pipeline.ts use this to record the refusal as a
    // failure for the component instead of treating it as COMPLETED.
    expect(result).toEqual({
      created: 0,
      updated: 0,
      skipped: 41,
      capped: true,
    });
    expect(mockThreatCreate).not.toHaveBeenCalled();
    expect(mockThreatUpdate).not.toHaveBeenCalled();
  });

  it("40 threats (exactly at cap) writes all", async () => {
    const batch = Array.from({ length: 40 }, (_, i) =>
      makeThreat(`Threat ${i}`, "comp-1"),
    );

    const result = await persistAIThreats("model-1", "user-1", batch);

    // Strict greater-than: 40 is allowed, 41 is not.
    expect(mockThreatCreate).toHaveBeenCalledTimes(40);
    expect(result.created).toBe(40);
  });

  it("anomaly-5: cap is batch-level, NOT cumulative-with-DB", async () => {
    // Existing state: 35 threats already in DB for this component.
    mockThreatFindMany.mockResolvedValueOnce(
      Array.from({ length: 35 }, (_, i) => ({
        id: `existing-${i}`,
        name: `Old Threat ${i}`,
        componentNodeId: "node-c1",
        reviewStatus: "PENDING",
        source: "AI_SUGGESTED",
        manuallyEdited: false,
      })),
    );

    // New call brings 10 more threats. If the cap checked cumulative totals
    // (35 existing + 10 new = 45 > 40), this would wrongly reject.
    // The cap MUST look at the batch only, not DB state.
    const batch = Array.from({ length: 10 }, (_, i) =>
      makeThreat(`New Threat ${i}`, "comp-1"),
    );

    const result = await persistAIThreats("model-1", "user-1", batch);

    // 10 new writes — cap did NOT fire.
    expect(result.created + result.updated).toBe(10);
  });

  it("30 threats split across 2 components writes all (per-component)", async () => {
    mockComponentFindMany.mockResolvedValueOnce([
      { id: "comp-1", nodeId: "node-c1", analysisHash: "abc" },
      { id: "comp-2", nodeId: "node-c2", analysisHash: "def" },
    ]);

    const batch = [
      ...Array.from({ length: 30 }, (_, i) => makeThreat(`A${i}`, "comp-1")),
      ...Array.from({ length: 30 }, (_, i) => makeThreat(`B${i}`, "comp-2")),
    ];

    const result = await persistAIThreats("model-1", "user-1", batch);

    // Total 60 but 30/30 split — below cap per-component.
    expect(result.created).toBe(60);
  });
});
