/**
 * Duplicate guard, re-analysis half: a new AI threat that the detector puts
 * in the merge band with an EXISTING threat (human-authored, reviewed, or a
 * prior run's) is not created again — it is linked instead.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { persistAIThreats } from "../review-service.js";
import type { MicroThreat } from "../../ai/micro-analysis/types.js";

const mockThreatCreate = vi.fn();
const mockPrisma = {
  threatModel: { findUnique: vi.fn() },
  component: { findMany: vi.fn() },
  threat: {
    findMany: vi.fn(),
    update: vi.fn(),
    create: mockThreatCreate,
  },
  mitigation: { create: vi.fn() },
};

vi.mock("../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function aiThreat(name: string): MicroThreat {
  return {
    name,
    description: "Kong accepts tokens whose alg header was switched.",
    category: "TAMPERING",
    severity: "HIGH",
    componentId: "db-comp-a",
    componentName: "API Gateway",
    cweIds: ["CWE-347"],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "low", effectiveness: "0.5" },
    confidence: 0.7,
    sourceMethodology: "stride",
  };
}

function existingRow(over: Record<string, unknown>) {
  return {
    id: "existing-1",
    name: "JWT Signature Verification Bypass via Algorithm Confusion",
    description: "Algorithm confusion lets an attacker forge tokens.",
    componentNodeId: "node-a",
    connectionEdgeId: null,
    strideCategories: '["SPOOFING"]',
    cweIds: '["CWE-347"]',
    reviewStatus: "PENDING",
    source: "MANUAL",
    manuallyEdited: false,
    analysisSessionId: null,
    dedupSupersededById: null,
    ...over,
  };
}

describe("persistAIThreats — re-analysis duplicate linking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.threatModel.findUnique.mockResolvedValue({ id: "model-1" });
    mockPrisma.component.findMany.mockResolvedValue([
      { id: "db-comp-a", nodeId: "node-a", analysisHash: null },
    ]);
    mockThreatCreate.mockResolvedValue({ id: "new-1" });
  });

  it("links a reworded duplicate of a human threat instead of creating it", async () => {
    mockPrisma.threat.findMany.mockResolvedValue([existingRow({})]);
    const res = await persistAIThreats(
      "model-1",
      "user-1",
      [aiThreat("JWT Signature Bypass via Algorithm Confusion")],
      undefined,
      undefined,
      "session-2",
    );
    expect(mockThreatCreate).not.toHaveBeenCalled();
    expect(res.created).toBe(0);
    expect(res.linked).toEqual([
      {
        name: "JWT Signature Bypass via Algorithm Confusion",
        componentNodeId: "node-a",
        existingThreatId: "existing-1",
        score: expect.any(Number),
      },
    ]);
  });

  it("links to a prior run's PENDING AI threat too", async () => {
    mockPrisma.threat.findMany.mockResolvedValue([
      existingRow({ source: "AI_SUGGESTED", analysisSessionId: "session-1" }),
    ]);
    const res = await persistAIThreats(
      "model-1",
      "user-1",
      [aiThreat("JWT Signature Bypass via Algorithm Confusion")],
      undefined,
      undefined,
      "session-2",
    );
    expect(mockThreatCreate).not.toHaveBeenCalled();
    expect(res.linked).toHaveLength(1);
  });

  it("does not link to a row this same session wrote (in-run merges are the guard's job)", async () => {
    mockPrisma.threat.findMany.mockResolvedValue([
      existingRow({ source: "AI_SUGGESTED", analysisSessionId: "session-2" }),
    ]);
    const res = await persistAIThreats(
      "model-1",
      "user-1",
      [aiThreat("JWT Signature Bypass via Algorithm Confusion")],
      undefined,
      undefined,
      "session-2",
    );
    expect(mockThreatCreate).toHaveBeenCalledTimes(1);
    expect(res.linked ?? []).toEqual([]);
  });

  it("ignores rows already marked as superseded duplicates", async () => {
    mockPrisma.threat.findMany.mockResolvedValue([
      existingRow({ dedupSupersededById: "other" }),
    ]);
    await persistAIThreats(
      "model-1",
      "user-1",
      [aiThreat("JWT Signature Bypass via Algorithm Confusion")],
      undefined,
      undefined,
      "session-2",
    );
    expect(mockThreatCreate).toHaveBeenCalledTimes(1);
  });

  it("still creates a threat that is merely similar (review band), never links it", async () => {
    mockPrisma.threat.findMany.mockResolvedValue([
      existingRow({
        name: "Redis Cache Integrity Bypass via Unencrypted API Key",
        cweIds: "[]",
      }),
    ]);
    await persistAIThreats(
      "model-1",
      "user-1",
      [
        {
          ...aiThreat("Redis Connection Spoofing via Unencrypted API Key"),
          cweIds: [],
        },
      ],
      undefined,
      undefined,
      "session-2",
    );
    expect(mockThreatCreate).toHaveBeenCalledTimes(1);
  });
});
