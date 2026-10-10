/**
 * ChainScorer stage unit tests — attack-chain Pass 5.
 *
 * Proves the residual-severity model reuse:
 *  - residual severity DROPS when a breaking-hop mitigation is IMPLEMENTED,
 *  - residual severity EQUALS base severity when the same mitigation is NOT yet
 *    IMPLEMENTED (the toggle that makes the drop meaningful),
 *  - a validated chain is persisted AI_SUGGESTED via the AttackChain CRUD
 *    with residualSeverity + per-hop isMitigated/mitigationIds,
 *  - registration via stages/index.ts side-effect.
 *
 * Prisma is mocked so the persist proof runs without a live DB.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ThreatModelContext } from "../../../types/ai.js";
import type { StageContext } from "./registry.js";
import type { CandidateChain } from "./path-generator.js";

const mockThreatFindMany = vi.fn();
const mockChainCreate = vi.fn();
const mockPrisma = {
  threat: { findMany: mockThreatFindMany },
  attackChain: { create: mockChainCreate },
};

vi.mock("../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { chainScorerStage, scoreChain, buildThreatIndex } = await import(
  "./chain-scorer.js"
);
const { registerStageHandlers } = await import("./index.js");
const { getStage, resetStageRegistry } = await import("./registry.js");

function context(): ThreatModelContext {
  return {
    name: "ctx",
    components: [
      { id: "A", name: "Edge", type: "GATEWAY" },
      { id: "B", name: "DB", type: "DATABASE" },
    ],
    connections: [{ id: "e1", source: "A", target: "B" }],
    boundaries: [],
  };
}

/** A CRITICAL chain whose 2nd hop exploits threat `t-db` (normalized "sqli"). */
function criticalChain(): CandidateChain {
  return {
    entryPointId: "A",
    targetAssetId: "B",
    name: "edge to db",
    description: "pivot to db",
    severity: "CRITICAL",
    hops: [
      {
        componentId: "A",
        threatRef: "A::xss",
        description: "xss",
        preconditions: ["network:public"],
        yields: ["creds:user"],
      },
      {
        componentId: "B",
        threatRef: "B::sqli",
        description: "sqli",
        preconditions: ["creds:user"],
        yields: ["data:read:RESTRICTED"],
      },
    ],
    entryPointName: "Edge",
    targetAssetName: "DB",
  } as CandidateChain;
}

/** Index where the B::sqli threat has one mitigation at the given status. */
function indexWithMitigation(status: string, effectiveness = 0.85) {
  return buildThreatIndex([
    {
      id: "t-db",
      componentNodeId: "B",
      normalizedName: "sqli",
      mitigations: [{ id: "m-1", status, effectivenessScore: effectiveness }],
    },
  ]);
}

function makeCtx(inputs: Record<string, unknown>): StageContext {
  return {
    executionId: "exec-cs",
    threatModelId: "tm-cs",
    organizationId: "org-1",
    sessionId: "session-cs",
    inputs,
    aiCall: async () => "[]",
    progress: async () => undefined,
    checkpoint: async () => undefined,
    signal: new AbortController().signal,
  };
}

describe("ChainScorer — residual severity (Pass 5, mitigation effectiveness)", () => {
  it("residual severity DROPS when a breaking mitigation is IMPLEMENTED", () => {
    const scoredImplemented = scoreChain(
      criticalChain(),
      indexWithMitigation("IMPLEMENTED", 0.85),
    );
    const scoredNot = scoreChain(
      criticalChain(),
      indexWithMitigation("NOT_IMPLEMENTED", 0.85),
    );

    // Not-implemented → no breaking control → residual equals base (CRITICAL).
    expect(scoredNot.residualSeverity).toBe("CRITICAL");
    // Implemented 0.85-effective control → residual fraction 0.15 → drops ≥ 2 steps.
    expect(scoredImplemented.residualSeverity).not.toBe("CRITICAL");
    const ladder = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
    expect(ladder.indexOf(scoredImplemented.residualSeverity)).toBeLessThan(
      ladder.indexOf("CRITICAL"),
    );
    // The breaking hop is flagged mitigated and carries the mitigation id.
    expect(scoredImplemented.hopMitigations[1].isMitigated).toBe(true);
    expect(scoredImplemented.hopMitigations[1].mitigationIds).toEqual(["m-1"]);
  });

  it("an unresolved threatRef leaves the hop unmitigated (residual 1)", () => {
    const scored = scoreChain(criticalChain(), buildThreatIndex([]));
    expect(scored.residualSeverity).toBe("CRITICAL");
    expect(scored.hopMitigations.every((h) => !h.isMitigated)).toBe(true);
  });
});

describe("ChainScorer stage handler (pass 5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStageRegistry();
    mockChainCreate.mockResolvedValue({ id: "chain-1" });
  });

  it("registers via stages/index.ts side-effect registration", () => {
    expect(() => getStage("ChainScorer")).toThrowError(/not registered/);
    registerStageHandlers();
    expect(getStage("ChainScorer")).toBe(chainScorerStage);
  });

  it("persists a scored chain AI_SUGGESTED with residualSeverity + hop mitigation flags", async () => {
    mockThreatFindMany.mockResolvedValue([
      {
        id: "t-db",
        componentNodeId: "B",
        normalizedName: "sqli",
        mitigations: [
          { id: "m-1", status: "IMPLEMENTED", effectivenessScore: 0.85 },
        ],
      },
    ]);

    const result = await chainScorerStage(
      makeCtx({
        context: context(),
        validatedChains: [criticalChain()],
        persist: { threatModelId: "tm-cs" },
      }),
    );

    expect(result.outputs.chainsPersisted).toBe(1);
    expect(mockChainCreate).toHaveBeenCalledTimes(1);
    const arg = mockChainCreate.mock.calls[0][0].data;
    expect(arg.status).toBe("AI_SUGGESTED");
    expect(arg.severity).toBe("CRITICAL");
    expect(arg.residualSeverity).not.toBe("CRITICAL"); // dropped by the IMPLEMENTED control
    // The 2nd hop is mitigated; its componentName resolved from context.
    const hops = arg.hops.create as Array<{
      isMitigated: boolean;
      mitigationIds: string;
      componentName: string;
      position: number;
    }>;
    expect(hops[1].isMitigated).toBe(true);
    expect(JSON.parse(hops[1].mitigationIds)).toEqual(["m-1"]);
    expect(hops[1].componentName).toBe("DB");
    expect(hops[0].position).toBe(0);
  });

  it("scores without persisting when persist is absent (DB-free)", async () => {
    const result = await chainScorerStage(
      makeCtx({ context: context(), validatedChains: [criticalChain()] }),
    );
    expect(result.outputs.chainsPersisted).toBe(0);
    expect(mockChainCreate).not.toHaveBeenCalled();
    expect(mockThreatFindMany).not.toHaveBeenCalled();
    // Without DB threats, nothing breaks the chain → residual equals base.
    const scored = result.outputs.scoredChains as Array<{
      residualSeverity: string;
    }>;
    expect(scored[0].residualSeverity).toBe("CRITICAL");
  });

  it("throws without validatedChains", async () => {
    await expect(chainScorerStage(makeCtx({}))).rejects.toThrow(
      /requires inputs.validatedChains/,
    );
  });
});
