/**
 * The loser-cleanup block in pipeline.ts used to
 * `prisma.threat.deleteMany` the streaming-write rows that LLM dedup
 * collapsed into a canonical representative. That's destructive: a wrong
 * dedup decision permanently loses a finding with no recovery path.
 *
 * This locks in the replacement contract: losers are MARKED via
 * `dedupSupersededById` (never deleted), survivors are left untouched, and
 * rows outside the session/PENDING/AI_SUGGESTED/manuallyEdited=false scope
 * are never touched — mirrors the mock-prisma pattern used by
 * incremental-skip.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { markDedupLosers } from "../pipeline.js";
import type { MicroThreat } from "../types.js";
import { normalizeThreatName } from "../../../threat-review/normalize-threat-name.js";

const WINNER = "JWT Signature Verification Bypass via Algorithm Confusion";

const mockThreatFindMany = vi.fn();
const mockThreatUpdateMany = vi.fn();
const mockThreatDeleteMany = vi.fn();

const mockPrisma = {
  threat: {
    findMany: mockThreatFindMany,
    updateMany: mockThreatUpdateMany,
    deleteMany: mockThreatDeleteMany,
  },
};

vi.mock("../../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

vi.mock("../../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function makeThreat(name: string, componentId: string): MicroThreat {
  return {
    name,
    description: "",
    category: "TAMPERING",
    severity: "HIGH",
    componentId,
    componentName: "Web App",
    cweIds: [],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "low", effectiveness: "0.5" },
    confidence: 0.8,
    sourceMethodology: "stride",
  };
}

describe("markDedupLosers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks losers via dedupSupersededById instead of deleting them", async () => {
    // Streaming persist wrote 3 rows for node-1 (paraphrases of the same
    // vuln); LLM dedup canonicalized to 1 survivor.
    mockThreatFindMany.mockResolvedValue([
      {
        id: "winner-id",
        name: WINNER,
        componentNodeId: "node-1",
        connectionEdgeId: null,
        normalizedName: normalizeThreatName(WINNER),
      },
      {
        id: "loser-id-1",
        name: "JWT Signature Bypass via Algorithm Confusion",
        componentNodeId: "node-1",
        connectionEdgeId: null,
        normalizedName: "loserone",
      },
      {
        id: "loser-id-2",
        name: "JWT Signature Verification Bypass by Algorithm Confusion Attack",
        componentNodeId: "node-1",
        connectionEdgeId: null,
        normalizedName: "losertwo",
      },
    ]);
    mockThreatUpdateMany.mockResolvedValue({ count: 2 });

    const deduped: MicroThreat[] = [makeThreat(WINNER, "comp-1")];
    const dbIdToNodeId = new Map([["comp-1", "node-1"]]);

    const result = await markDedupLosers({
      threatModelId: "tm-1",
      sessionId: "session-1",
      deduped,
      dbIdToNodeId,
    });

    // Never deletes.
    expect(mockThreatDeleteMany).not.toHaveBeenCalled();

    // Marks exactly the 2 losers, pointing at the survivor's id.
    expect(mockThreatUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: expect.arrayContaining(["loser-id-1", "loser-id-2"]) },
      },
      data: { dedupSupersededById: "winner-id" },
    });
    const calledIds = mockThreatUpdateMany.mock.calls[0][0].where.id.in;
    expect(calledIds).not.toContain("winner-id");
    expect(result.marked).toBe(2);
  });

  it("does NOT mark a loser the detector cannot confirm as a duplicate of any survivor", async () => {
    // The dedup LLM clustered an unrelated threat into the JWT cluster. Without
    // detector confirmation it stays an ordinary, unmarked threat.
    mockThreatFindMany.mockResolvedValue([
      {
        id: "winner-id",
        name: WINNER,
        componentNodeId: "node-1",
        connectionEdgeId: null,
        normalizedName: normalizeThreatName(WINNER),
      },
      {
        id: "unrelated-id",
        name: "Unbounded Queue Growth and Memory Exhaustion",
        componentNodeId: "node-1",
        connectionEdgeId: null,
        normalizedName: "unrelated",
      },
    ]);

    const result = await markDedupLosers({
      threatModelId: "tm-1",
      sessionId: "session-1",
      deduped: [makeThreat(WINNER, "comp-1")],
      dbIdToNodeId: new Map([["comp-1", "node-1"]]),
    });

    expect(mockThreatUpdateMany).not.toHaveBeenCalled();
    expect(mockThreatDeleteMany).not.toHaveBeenCalled();
    expect(result.marked).toBe(0);
    expect(result.unconfirmed).toEqual([
      {
        threatId: "unrelated-id",
        name: "Unbounded Queue Growth and Memory Exhaustion",
      },
    ]);
  });

  it("attributes a guard merge to its exact survivor, following merge chains", async () => {
    const OTHER = "Webhook Signature Spoofing for Charge Result Injection";
    mockThreatFindMany.mockResolvedValue([
      {
        id: "winner-id",
        name: WINNER,
        componentNodeId: "node-1",
        connectionEdgeId: null,
        normalizedName: normalizeThreatName(WINNER),
      },
      {
        id: "other-winner-id",
        name: OTHER,
        componentNodeId: "node-1",
        connectionEdgeId: null,
        normalizedName: normalizeThreatName(OTHER),
      },
      {
        id: "loser-id",
        name: "Charge Result Injection by Spoofed Webhook Signature",
        componentNodeId: "node-1",
        connectionEdgeId: null,
        normalizedName: normalizeThreatName(
          "Charge Result Injection by Spoofed Webhook Signature",
        ),
      },
      {
        id: "middle-id",
        name: "Spoofed Webhook Signature Charge Injection",
        componentNodeId: "node-1",
        connectionEdgeId: null,
        normalizedName: normalizeThreatName(
          "Spoofed Webhook Signature Charge Injection",
        ),
      },
    ]);
    mockThreatUpdateMany.mockResolvedValue({ count: 2 });
    const ref = (name: string) => ({ componentId: "comp-1", name });

    await markDedupLosers({
      threatModelId: "tm-1",
      sessionId: "session-1",
      deduped: [makeThreat(WINNER, "comp-1"), makeThreat(OTHER, "comp-1")],
      dbIdToNodeId: new Map([["comp-1", "node-1"]]),
      guardMerges: [
        {
          survivor: ref("Spoofed Webhook Signature Charge Injection"),
          loser: ref("Charge Result Injection by Spoofed Webhook Signature"),
          score: 0.7,
          via: "detector",
          reasons: [],
        },
        {
          survivor: ref(OTHER),
          loser: ref("Spoofed Webhook Signature Charge Injection"),
          score: 0.7,
          via: "detector",
          reasons: [],
        },
      ],
    });

    expect(mockThreatUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: expect.arrayContaining(["loser-id", "middle-id"]) } },
      data: { dedupSupersededById: "other-winner-id" },
    });
  });

  it("does nothing when every session row survived (no losers)", async () => {
    mockThreatFindMany.mockResolvedValue([
      {
        id: "winner-id",
        componentNodeId: "node-1",
        connectionEdgeId: null,
        normalizedName: "winner",
      },
    ]);

    const deduped: MicroThreat[] = [makeThreat("Winner", "comp-1")];
    const dbIdToNodeId = new Map([["comp-1", "node-1"]]);

    const result = await markDedupLosers({
      threatModelId: "tm-1",
      sessionId: "session-1",
      deduped,
      dbIdToNodeId,
    });

    expect(mockThreatUpdateMany).not.toHaveBeenCalled();
    expect(mockThreatDeleteMany).not.toHaveBeenCalled();
    expect(result.marked).toBe(0);
  });

  it("leaves an unattributed loser untouched (never deleted) when no survivor is found for its target", async () => {
    // node-2's row has no survivor in this query result at all (e.g. the
    // retry-scope filter excluded it) — markDedupLosers must not fabricate
    // a winner id. The row is simply left alone, never deleted.
    mockThreatFindMany.mockResolvedValue([
      {
        id: "winner-id",
        componentNodeId: "node-1",
        connectionEdgeId: null,
        normalizedName: "winner",
      },
      {
        id: "orphan-loser-id",
        componentNodeId: "node-2",
        connectionEdgeId: null,
        normalizedName: "orphanloser",
      },
    ]);

    const deduped: MicroThreat[] = [makeThreat("Winner", "comp-1")];
    const dbIdToNodeId = new Map([["comp-1", "node-1"]]);

    const result = await markDedupLosers({
      threatModelId: "tm-1",
      sessionId: "session-1",
      deduped,
      dbIdToNodeId,
    });

    expect(mockThreatDeleteMany).not.toHaveBeenCalled();
    expect(mockThreatUpdateMany).not.toHaveBeenCalled();
    expect(result.marked).toBe(0);
  });

  it("scopes the lookup to session + PENDING + AI_SUGGESTED + manuallyEdited=false", async () => {
    mockThreatFindMany.mockResolvedValue([]);
    const deduped: MicroThreat[] = [makeThreat("Winner", "comp-1")];

    await markDedupLosers({
      threatModelId: "tm-1",
      sessionId: "session-1",
      deduped,
      dbIdToNodeId: new Map(),
    });

    expect(mockThreatFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          threatModelId: "tm-1",
          analysisSessionId: "session-1",
          source: "AI_SUGGESTED",
          reviewStatus: "PENDING",
          manuallyEdited: false,
        }),
      }),
    );
  });

  it("restricts the lookup to nodeIdScope when supplied (retry-merge safety)", async () => {
    mockThreatFindMany.mockResolvedValue([]);
    const deduped: MicroThreat[] = [makeThreat("Winner", "comp-1")];

    await markDedupLosers({
      threatModelId: "tm-1",
      sessionId: "session-1",
      deduped,
      dbIdToNodeId: new Map(),
      nodeIdScope: new Set(["node-retried"]),
    });

    expect(mockThreatFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          componentNodeId: { in: ["node-retried"] },
        }),
      }),
    );
  });
});
