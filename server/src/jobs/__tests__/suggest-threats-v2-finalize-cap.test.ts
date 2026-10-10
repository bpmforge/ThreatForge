/**
 * `finalizeV2Run`'s `persistAIThreats` caller must not just log when the final
 * persist result carries `capped: true` (review-service.ts's
 * MAX_THREATS_PER_COMPONENT_PER_RUN returns a success-shaped `{ created: 0,
 * updated: 0, skipped: n, capped: true }` when it refuses the whole batch).
 * Both `pipeline.ts` call sites (streaming + final persist) already handle
 * this — see pipeline-cap-failure.test.ts. Without the same handling here, a
 * capped run would be reported as a clean COMPLETED with the batch silently
 * unpersisted.
 *
 * Mirrors pipeline.ts's final-persist block: on `capped`, record a
 * "component-cap" ParseFailure instead of only logging.
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
  components: [{ id: "comp-a", name: "A" }],
  connections: [],
  boundaries: [],
  sequenceFlows: [],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

function threat(name: string, componentId: string): MicroThreat {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { name, componentId, category: "SPOOFING", severity: "HIGH" } as any;
}

describe("finalizeV2Run — final-persist cap surfaced (not silently COMPLETED)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildNodeIdMaps.mockResolvedValue({
      dbIdToNodeId: new Map([["comp-a", "node-a"]]),
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
    parseFailures:
      [] as import("../../services/ai/micro-analysis/types.js").ParseFailure[],
    methodologies: ["stride" as const],
    llmCalls: 1,
    skippedComponentCount: 0,
    startTime: Date.now(),
    dirtyComponentDbIds: new Set<string>(),
    report: () => {},
  };

  it("records the capped final persist as a parseFailure instead of completing silently", async () => {
    mockPersistAIThreats.mockResolvedValue({
      created: 0,
      updated: 0,
      skipped: 1,
      capped: true,
    });

    const result = await finalizeV2Run({
      ...baseArgs,
      parseFailures: [],
      deduped: [threat("Spoof A", "comp-a")],
      failedUnits: [],
    });

    expect(result.summary.parseFailures).toBeGreaterThan(0);
    expect(result.parseFailures.some((f) => f.stage === "component-cap")).toBe(
      true,
    );
  });

  it("does not add a parseFailure on a clean (uncapped) final persist", async () => {
    mockPersistAIThreats.mockResolvedValue({
      created: 1,
      updated: 0,
      skipped: 0,
    });

    const result = await finalizeV2Run({
      ...baseArgs,
      parseFailures: [],
      deduped: [threat("Spoof A", "comp-a")],
      failedUnits: [],
    });

    expect(result.summary.parseFailures).toBe(0);
    expect(result.parseFailures.some((f) => f.stage === "component-cap")).toBe(
      false,
    );
  });
});
