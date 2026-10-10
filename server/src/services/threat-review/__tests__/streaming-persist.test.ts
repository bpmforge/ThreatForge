/**
 * Wave C — Streaming Persistence Tests
 *
 * Verifies that:
 * 1. Streaming write + final write produces no duplicates
 * 2. batchScope.componentNodeId narrows existing-threat lookup
 * 3. Final write refreshes mitigations on streamed threats
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { persistAIThreats } from "../review-service.js";
import type { MicroThreat } from "../../ai/micro-analysis/types.js";

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockThreatUpdate = vi.fn();
const mockThreatCreate = vi.fn();
const mockMitigationCreate = vi.fn();
const mockMitigationDeleteMany = vi.fn();
const mockThreatFindMany = vi.fn();
const mockComponentFindMany = vi.fn();

const mockPrisma = {
  threatModel: {
    findUnique: vi.fn(),
  },
  component: {
    findMany: mockComponentFindMany,
  },
  threat: {
    findMany: mockThreatFindMany,
    update: mockThreatUpdate,
    create: mockThreatCreate,
  },
  mitigation: {
    create: mockMitigationCreate,
    deleteMany: mockMitigationDeleteMany,
  },
  requirement: {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "req-1" }),
  },
  mitigationRequirement: {
    create: vi.fn().mockResolvedValue({}),
  },
};

vi.mock("../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

vi.mock("../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeThreat(
  name: string,
  componentId: string,
  mitigations: MicroThreat["mitigations"] = [],
): MicroThreat {
  return {
    name,
    description: "Test description",
    category: "TAMPERING",
    severity: "HIGH",
    componentId,
    componentName: "Test Component",
    cweIds: [],
    owaspIds: [],
    evidence: {},
    mitigations,
    mitigation: { description: "", effort: "low", effectiveness: "0.5" },
    confidence: 0.9,
    sourceMethodology: "stride",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("persistAIThreats — streaming persistence (Wave C)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComponentFindMany.mockReset();

    mockPrisma.threatModel.findUnique.mockResolvedValue({ id: "model-1" });

    // Default component map
    mockComponentFindMany.mockResolvedValue([
      { id: "comp-1", nodeId: "node-c1", analysisHash: "abc" },
      { id: "comp-2", nodeId: "node-c2", analysisHash: "def" },
    ]);

    mockThreatCreate.mockResolvedValue({ id: "t-new" });
    mockThreatUpdate.mockResolvedValue({ id: "t-1" });
    mockMitigationCreate.mockResolvedValue({ id: "mit-1" });
    mockMitigationDeleteMany.mockResolvedValue({ count: 0 });
  });

  it("streaming write + final write produces no duplicates", async () => {
    const threatA = makeThreat("SQL Injection", "comp-1");
    const threatB = makeThreat("XSS Attack", "comp-1");

    // --- Streaming write (no scope for first call, but scoped by component) ---
    mockThreatFindMany.mockResolvedValueOnce([]); // no existing for node-c1

    await persistAIThreats("model-1", "user-1", [threatA], undefined, {
      componentNodeId: "node-c1",
    });

    expect(mockThreatCreate).toHaveBeenCalledTimes(1);
    expect(mockThreatCreate.mock.calls[0][0].data.name).toBe("SQL Injection");

    // --- Final write (threatA already exists, threatB is new) ---
    mockThreatFindMany.mockResolvedValueOnce([
      {
        id: "t-1",
        name: "SQL Injection",
        componentNodeId: "node-c1",
        reviewStatus: "PENDING",
        source: "AI_SUGGESTED",
        manuallyEdited: false,
      },
    ]);

    const result = await persistAIThreats("model-1", "user-1", [
      threatA,
      threatB,
    ]);

    // threatA: updated (already exists), threatB: created
    expect(result.updated).toBe(1);
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);

    // Total creates across both calls: 1 (streaming) + 1 (final, threatB) = 2
    expect(mockThreatCreate).toHaveBeenCalledTimes(2);
  });

  it("batchScope.componentNodeId narrows existing-threat lookup", async () => {
    const newThreat = makeThreat("Auth Bypass", "comp-1");

    // Existing PENDING threat on comp-2 with the same name — should NOT match
    // when batchScope limits to node-c1.
    mockThreatFindMany.mockResolvedValueOnce([
      // This is what findMany returns when scoped to node-c1 — empty
    ]);

    const result = await persistAIThreats(
      "model-1",
      "user-1",
      [newThreat],
      undefined,
      { componentNodeId: "node-c1" },
    );

    // New threat created for c1 — c2 threat with same name is not touched
    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);

    // Confirm the findMany was called with componentNodeId scope
    const findManyCall = mockThreatFindMany.mock.calls[0][0];
    expect(findManyCall.where.componentNodeId).toBe("node-c1");
  });

  it("final write refreshes mitigations on streamed threats", async () => {
    const mitigations: MicroThreat["mitigations"] = [
      {
        description: "Use parameterized queries",
        controlCategory: "INPUT_VALIDATION",
        testCriteria: "Verify prepared statements",
        effort: "LOW",
        effectiveness: "0.8",
      },
      {
        description: "Enable WAF",
        controlCategory: "NETWORK",
        testCriteria: "Verify WAF rules",
        effort: "MEDIUM",
        effectiveness: "0.6",
      },
    ];

    const updatedThreat = makeThreat("SQL Injection", "comp-1", mitigations);

    // Threat already exists (created by streaming write) with no mitigations
    mockThreatFindMany.mockResolvedValueOnce([
      {
        id: "t-existing",
        name: "SQL Injection",
        componentNodeId: "node-c1",
        reviewStatus: "PENDING",
        source: "AI_SUGGESTED",
        manuallyEdited: false,
      },
    ]);

    // deleteMany removes 0 (no existing AI mitigations to clear)
    mockMitigationDeleteMany.mockResolvedValueOnce({ count: 0 });

    const result = await persistAIThreats("model-1", "user-1", [updatedThreat]);

    expect(result.updated).toBe(1);

    // deleteMany was called to clear stale AI mitigations — scoped to source
    // AI since D2, so a human or template row on the same threat survives.
    expect(mockMitigationDeleteMany).toHaveBeenCalledWith({
      where: {
        threatId: "t-existing",
        source: "AI",
        status: "NOT_IMPLEMENTED",
        verified: false,
      },
    });

    // Two new mitigations created
    expect(mockMitigationCreate).toHaveBeenCalledTimes(2);
  });
});
