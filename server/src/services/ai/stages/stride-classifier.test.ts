/**
 * StrideClassifier stage handler unit tests. Default mode is
 * validate-only: repairs would change threats relative to the legacy
 * pipeline, so they are gated behind repairCategories.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { MicroThreat } from "../micro-analysis/types.js";
import { registerStageHandlers } from "./index.js";
import { getStage, resetStageRegistry, type StageContext } from "./registry.js";
import {
  CLASSIFIER_BATCH_SIZE,
  strideClassifierStage,
} from "./stride-classifier.js";

function threat(overrides: Partial<MicroThreat> = {}): MicroThreat {
  return {
    name: "Stub threat",
    description: "desc",
    category: "TAMPERING",
    severity: "MEDIUM",
    componentId: "web",
    componentName: "Web App",
    cweIds: [],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "MEDIUM", effectiveness: "0.5" },
    confidence: 0.8,
    sourceMethodology: "stride",
    ...overrides,
  };
}

function makeCtx(
  inputs: Record<string, unknown>,
  aiCall?: StageContext["aiCall"],
): StageContext {
  return {
    executionId: "exec-1",
    threatModelId: "tm-1",
    organizationId: "org-1",
    sessionId: "session-1",
    inputs,
    aiCall:
      aiCall ??
      (async () => {
        throw new Error("unexpected LLM call");
      }),
    progress: async () => undefined,
    checkpoint: async () => undefined,
    signal: new AbortController().signal,
  };
}

describe("StrideClassifier stage handler", () => {
  beforeEach(() => {
    resetStageRegistry();
  });

  it("registers via stages/index.ts side-effect registration", () => {
    expect(() => getStage("StrideClassifier")).toThrowError(/not registered/);
    registerStageHandlers();
    expect(getStage("StrideClassifier")).toBe(strideClassifierStage);
  });

  it("validate-only (default): zero LLM calls, identity pass-through, invalid labels reported", async () => {
    let llmCalls = 0;
    const threats = [
      threat(),
      threat({ name: "Bad label", category: "NOT_A_CATEGORY" }),
    ];
    const result = await strideClassifierStage(
      makeCtx({ threats }, async () => {
        llmCalls++;
        return "[]";
      }),
    );

    expect(llmCalls).toBe(0);
    expect(result.outputs.classifiedThreats).toBe(threats); // identity
    expect(result.outputs.invalidCategories).toEqual([
      { name: "Bad label", componentId: "web", category: "NOT_A_CATEGORY" },
    ]);
    expect(result.parseFailures).toEqual([]);
  });

  it("repair mode: one LLM call per batch of ≤ 25 and applies valid corrections", async () => {
    const threats = Array.from({ length: CLASSIFIER_BATCH_SIZE + 5 }, (_, i) =>
      threat({ name: `T${i}` }),
    );
    const calls: string[] = [];
    const result = await strideClassifierStage(
      makeCtx({ threats, repairCategories: true }, async (_system, user) => {
        calls.push(user);
        // Correct index 1 of the FIRST batch only; second batch is clean.
        return calls.length === 1
          ? JSON.stringify([{ index: 1, category: "SPOOFING" }])
          : "[]";
      }),
    );

    expect(calls).toHaveLength(2); // 30 threats → batches of 25 + 5
    const classified = result.outputs.classifiedThreats as MicroThreat[];
    expect(classified[1].category).toBe("SPOOFING");
    expect(threats[1].category).toBe("TAMPERING"); // input not mutated
    expect(classified.filter((t) => t.category === "SPOOFING")).toHaveLength(1);
  });

  it("repair mode: rejects out-of-range indices, unknown categories, and survives parse failures", async () => {
    const threats = [threat({ name: "A" }), threat({ name: "B" })];
    const result = await strideClassifierStage(
      makeCtx({ threats, repairCategories: true }, async () =>
        JSON.stringify([
          { index: 99, category: "SPOOFING" }, // out of range
          { index: 0, category: "MADE_UP" }, // invalid label
        ]),
      ),
    );
    const classified = result.outputs.classifiedThreats as MicroThreat[];
    expect(classified.map((t) => t.category)).toEqual([
      "TAMPERING",
      "TAMPERING",
    ]);

    // Unparseable response → original labels kept + parseFailure recorded
    const failed = await strideClassifierStage(
      makeCtx({ threats, repairCategories: true }, async () => "not json"),
    );
    expect(
      (failed.outputs.classifiedThreats as MicroThreat[]).map(
        (t) => t.category,
      ),
    ).toEqual(["TAMPERING", "TAMPERING"]);
    expect(failed.parseFailures).toHaveLength(1);
    expect(failed.parseFailures[0].component).toBe("stride-classifier");
  });

  it("requires inputs.threats", async () => {
    await expect(strideClassifierStage(makeCtx({}))).rejects.toThrowError(
      /requires inputs\.threats/,
    );
  });
});
