/**
 * ChainValidator stage unit tests — attack-chain Pass 4.
 *
 * Pass-4 validation is CODE (ARCHITECTURE §2.5), so these tests need no LLM:
 *  - a chain with a DISCONNECTED hop (no edge path between consecutive hop
 *    components) is rejected by the code check — the LLM is NEVER called,
 *  - a chain needing `creds:admin` that is never yielded by entry assumptions
 *    or prior hops is rejected by the code check,
 *  - a fully-connected, capability-coherent chain SURVIVES and (with the LLM
 *    review on) is confirmed,
 *  - the secondary LLM review can refute a survivor (REFUTED ≥ threshold),
 *  - registration via stages/index.ts side-effect.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ThreatModelContext } from "../../../types/ai.js";
import {
  chainValidatorStage,
  codeValidateChain,
  buildAdjacency,
  isReachable,
} from "./chain-validator.js";
import { registerStageHandlers } from "./index.js";
import { getStage, resetStageRegistry } from "./registry.js";
import type { StageContext } from "./registry.js";
import type { CandidateChain } from "./path-generator.js";

vi.mock("../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/** A→B→C connected line graph (A-B, B-C). C is NOT adjacent to A directly. */
function lineContext(): ThreatModelContext {
  return {
    name: "line",
    components: [
      { id: "A", name: "Edge", type: "GATEWAY" },
      { id: "B", name: "Mid", type: "SERVICE" },
      { id: "C", name: "DB", type: "DATABASE" },
      { id: "Z", name: "Island", type: "SERVICE" }, // unconnected
    ],
    connections: [
      { id: "e1", source: "A", target: "B" },
      { id: "e2", source: "B", target: "C" },
    ],
    boundaries: [],
  };
}

function makeChain(
  hops: Array<{
    componentId: string;
    preconditions?: string[];
    yields?: string[];
  }>,
  name = "chain",
): CandidateChain {
  return {
    entryPointId: hops[0].componentId,
    targetAssetId: hops[hops.length - 1].componentId,
    name,
    description: "test chain",
    severity: "HIGH",
    hops: hops.map((h) => ({
      componentId: h.componentId,
      threatRef: `${h.componentId}::t`,
      description: "hop",
      preconditions: h.preconditions ?? [],
      yields: h.yields ?? [],
    })),
    entryPointName: hops[0].componentId,
    targetAssetName: hops[hops.length - 1].componentId,
  } as CandidateChain;
}

function makeCtx(
  inputs: Record<string, unknown>,
  aiCall: StageContext["aiCall"],
): StageContext {
  return {
    executionId: "exec-cv",
    threatModelId: "tm-cv",
    organizationId: "org-1",
    sessionId: "session-cv",
    inputs,
    aiCall,
    progress: async () => undefined,
    checkpoint: async () => undefined,
    signal: new AbortController().signal,
  };
}

describe("ChainValidator — pure code check (Pass 4, §2.5)", () => {
  it("buildAdjacency + isReachable treat edges as undirected, multi-hop", () => {
    const adj = buildAdjacency(lineContext());
    expect(isReachable("A", "B", adj)).toBe(true);
    expect(isReachable("A", "C", adj)).toBe(true); // multi-hop A-B-C
    expect(isReachable("C", "A", adj)).toBe(true); // undirected
    expect(isReachable("A", "Z", adj)).toBe(false); // island unreachable
  });

  it("rejects a chain with a DISCONNECTED hop", () => {
    const adj = buildAdjacency(lineContext());
    // A then jump straight to island Z — no edge path.
    const chain = makeChain([
      { componentId: "A", preconditions: ["network:public"], yields: ["x"] },
      { componentId: "Z", preconditions: ["x"], yields: [] },
    ]);
    const res = codeValidateChain(chain, adj);
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/not connected/);
  });

  it("rejects a chain needing creds:admin that is never yielded", () => {
    const adj = buildAdjacency(lineContext());
    const chain = makeChain([
      {
        componentId: "A",
        preconditions: ["network:public"],
        yields: ["creds:user"],
      },
      { componentId: "B", preconditions: ["creds:admin"], yields: [] }, // admin never yielded
    ]);
    const res = codeValidateChain(chain, adj);
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/creds:admin/);
    expect(res.reason).toMatch(/precondition/);
  });

  it("accepts a connected, capability-coherent chain", () => {
    const adj = buildAdjacency(lineContext());
    const chain = makeChain([
      {
        componentId: "A",
        preconditions: ["network:public"],
        yields: ["creds:user"],
      },
      {
        componentId: "B",
        preconditions: ["creds:user"],
        yields: ["network:internal"],
      },
      {
        componentId: "C",
        preconditions: ["network:internal"],
        yields: ["data:read:RESTRICTED"],
      },
    ]);
    expect(codeValidateChain(chain, adj).valid).toBe(true);
  });
});

describe("ChainValidator stage handler (pass 4)", () => {
  beforeEach(() => {
    resetStageRegistry();
  });

  it("registers via stages/index.ts side-effect registration", () => {
    expect(() => getStage("ChainValidator")).toThrowError(/not registered/);
    registerStageHandlers();
    expect(getStage("ChainValidator")).toBe(chainValidatorStage);
  });

  it("drops a disconnected chain in CODE without calling the LLM", async () => {
    const context = lineContext();
    const disconnected = makeChain(
      [
        { componentId: "A", preconditions: ["network:public"], yields: ["x"] },
        { componentId: "Z", preconditions: ["x"], yields: [] },
      ],
      "disconnected-chain",
    );

    let llmCalls = 0;
    const result = await chainValidatorStage(
      makeCtx({ context, candidateChains: [disconnected] }, async () => {
        llmCalls++;
        return "[]";
      }),
    );

    // No survivors → the secondary LLM review is never invoked.
    expect(llmCalls).toBe(0);
    expect(result.outputs.validatedChains).toHaveLength(0);
    const rejections = result.outputs.rejections as Array<{ reason: string }>;
    expect(rejections).toHaveLength(1);
    expect(rejections[0].reason).toMatch(/not connected/);
  });

  it("drops a creds:admin-needing chain in CODE without calling the LLM", async () => {
    const context = lineContext();
    const chain = makeChain(
      [
        {
          componentId: "A",
          preconditions: ["network:public"],
          yields: ["creds:user"],
        },
        { componentId: "B", preconditions: ["creds:admin"], yields: [] },
      ],
      "needs-admin",
    );

    let llmCalls = 0;
    const result = await chainValidatorStage(
      makeCtx({ context, candidateChains: [chain] }, async () => {
        llmCalls++;
        return "[]";
      }),
    );

    expect(llmCalls).toBe(0);
    expect(result.outputs.validatedChains).toHaveLength(0);
  });

  it("keeps a valid chain and confirms it via secondary LLM review", async () => {
    const context = lineContext();
    const good = makeChain(
      [
        {
          componentId: "A",
          preconditions: ["network:public"],
          yields: ["creds:user"],
        },
        {
          componentId: "B",
          preconditions: ["creds:user"],
          yields: ["network:internal"],
        },
        { componentId: "C", preconditions: ["network:internal"], yields: [] },
      ],
      "valid-chain",
    );

    let llmCalls = 0;
    const result = await chainValidatorStage(
      makeCtx({ context, candidateChains: [good] }, async () => {
        llmCalls++;
        return JSON.stringify([
          { threatRef: "valid-chain", verdict: "CONFIRMED", confidence: 0.9 },
        ]);
      }),
    );

    expect(llmCalls).toBe(1); // survivor reaches the review
    expect(result.outputs.validatedChains).toHaveLength(1);
  });

  it("lets the secondary review refute a survivor (REFUTED ≥ threshold)", async () => {
    const context = lineContext();
    const good = makeChain(
      [
        { componentId: "A", preconditions: ["network:public"], yields: ["x"] },
        { componentId: "B", preconditions: ["x"], yields: [] },
      ],
      "doomed-chain",
    );

    const result = await chainValidatorStage(
      makeCtx({ context, candidateChains: [good] }, async () =>
        JSON.stringify([
          {
            threatRef: "doomed-chain",
            verdict: "REFUTED",
            refutationReason: "implausible",
            confidence: 0.95,
          },
        ]),
      ),
    );

    expect(result.outputs.validatedChains).toHaveLength(0);
  });

  it("throws without context", async () => {
    await expect(
      chainValidatorStage(makeCtx({ candidateChains: [] }, async () => "[]")),
    ).rejects.toThrow(/requires inputs.context/);
  });
});
