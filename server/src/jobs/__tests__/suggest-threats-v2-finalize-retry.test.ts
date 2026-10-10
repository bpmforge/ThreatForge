/**
 * Finalize unit tests — partial marker + ADR-006 retry cleanup scoping.
 *
 * Two invariants the partial-failure / retry-failed feature depends on:
 *   1. `partial: true` + `failedUnits` are added to the result ONLY when a
 *      fan-out unit failed (a clean run's result is byte-identical to before).
 *   2. On a RETRY run (`retryUnits` present) the loser-cleanup sweep is
 *      SCOPED to the retried components' nodeIds — so the prior partial run's
 *      survivors on the SAME sessionId are NEVER deleted. Without this guard
 *      the retry (whose `deduped` is a tiny subset) would wipe the existing
 *      threat set. This is the ADR-006 "no orphans / merge, don't replace"
 *      proof for the retry path.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockPersistAIThreats = vi.fn();
vi.mock("../../services/threat-review/review-service.js", () => ({
  persistAIThreats: (...args: unknown[]) => mockPersistAIThreats(...args),
}));

vi.mock("../../services/threat-review/normalize-threat-name.js", () => ({
  normalizeThreatName: (n: string) => n.toLowerCase().replace(/\s+/g, "-"),
}));

const mockBuildNodeIdMaps = vi.fn();
vi.mock("../../services/ai/stages/identifier-context.js", () => ({
  buildNodeIdMaps: (...args: unknown[]) => mockBuildNodeIdMaps(...args),
}));

vi.mock("../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { finalizeV2Run } from "../suggest-threats-v2-finalize.js";
import type { MicroThreat } from "../../services/ai/micro-analysis/types.js";

const mockFindMany = vi.fn();
const mockDeleteMany = vi.fn();
const mockUpdateMany = vi.fn();

const prisma = {
  threat: {
    findMany: (...a: unknown[]) => mockFindMany(...a),
    deleteMany: (...a: unknown[]) => mockDeleteMany(...a),
  },
  component: { updateMany: (...a: unknown[]) => mockUpdateMany(...a) },
} as unknown as import("@prisma/client").PrismaClient;

const context = {
  name: "tm",
  methodology: "stride",
  components: [
    { id: "comp-a", name: "A" },
    { id: "comp-b", name: "B" },
  ],
  connections: [],
  boundaries: [],
  sequenceFlows: [],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

function threat(name: string, componentId: string): MicroThreat {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { name, componentId, category: "SPOOFING", severity: "HIGH" } as any;
}

describe("finalizeV2Run — partial + retry cleanup scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistAIThreats.mockResolvedValue({
      created: 1,
      updated: 0,
      skipped: 0,
    });
    mockBuildNodeIdMaps.mockResolvedValue({
      dbIdToNodeId: new Map([
        ["comp-a", "node-a"],
        ["comp-b", "node-b"],
      ]),
      nodeIdToDbId: new Map(),
    });
    mockFindMany.mockResolvedValue([]);
    mockDeleteMany.mockResolvedValue({ count: 0 });
    mockUpdateMany.mockResolvedValue({ count: 0 });
  });

  const baseArgs = {
    prisma,
    context,
    persist: { threatModelId: "tm-1", userId: "u-1", sessionId: "sess-1" },
    attackChains: [],
    parseFailures: [],
    methodologies: ["stride" as const],
    llmCalls: 1,
    skippedComponentCount: 0,
    startTime: Date.now(),
    dirtyComponentDbIds: new Set<string>(),
    report: () => {},
  };

  it("adds partial:true + failedUnits when a unit failed", async () => {
    const result = await finalizeV2Run({
      ...baseArgs,
      deduped: [threat("Spoof A", "comp-a")],
      failedUnits: [
        { componentId: "comp-b", category: "TAMPERING", error: "x" },
      ],
    });
    expect(result.partial).toBe(true);
    expect(result.failedUnits).toEqual([
      { componentId: "comp-b", category: "TAMPERING", error: "x" },
    ]);
  });

  it("omits partial/failedUnits on a clean run (frozen contract)", async () => {
    const result = await finalizeV2Run({
      ...baseArgs,
      deduped: [threat("Spoof A", "comp-a")],
      failedUnits: [],
    });
    expect(result.partial).toBeUndefined();
    expect(result.failedUnits).toBeUndefined();
  });

  it("scopes the loser-cleanup sweep to retried nodeIds (merge, not replace)", async () => {
    await finalizeV2Run({
      ...baseArgs,
      deduped: [threat("Spoof B", "comp-b")],
      failedUnits: [],
      retryUnits: [{ componentId: "comp-b", category: "TAMPERING" }],
    });

    // The session-row scan that drives the loser delete MUST be restricted to
    // the retried component's nodeId — prior survivors (node-a) are untouched.
    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.analysisSessionId).toBe("sess-1");
    expect(where.componentNodeId).toEqual({ in: ["node-b"] });
  });

  it("does NOT scope the sweep on a normal (non-retry) run", async () => {
    await finalizeV2Run({
      ...baseArgs,
      deduped: [threat("Spoof A", "comp-a")],
      failedUnits: [],
    });
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.componentNodeId).toBeUndefined();
  });

  it("surfaces verification counts in the summary when the Verifier ran", async () => {
    const result = await finalizeV2Run({
      ...baseArgs,
      deduped: [threat("Spoof A", "comp-a")],
      failedUnits: [],
      verification: { confirmed: 3, refuted: 2, uncertain: 1 },
    });
    expect(result.summary.verification).toEqual({
      confirmed: 3,
      refuted: 2,
      uncertain: 1,
    });
  });

  it("omits verification on a run without the Verifier (frozen contract)", async () => {
    const result = await finalizeV2Run({
      ...baseArgs,
      deduped: [threat("Spoof A", "comp-a")],
      failedUnits: [],
    });
    expect(result.summary.verification).toBeUndefined();
  });
});
