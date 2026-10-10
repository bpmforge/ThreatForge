/**
 * MitigationSynthesizer stage handler unit tests. DB-free: no
 * persist, so the preseed path never touches Prisma (it is exercised
 * end-to-end through the worker; its loading logic is a
 * byte-equivalent port of the legacy pipeline.ts block).
 *
 * Outside mitigations-only mode the stage defers mitigation to the
 * shared pass in finalizeV2Run (after dedup + the confidence floor), so the
 * mitigation tests below run the stage with `options.mitigationsOnly`.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { ComponentContext } from "../../threat-generation/context-aware-pipeline.js";
import type { MicroThreat } from "../micro-analysis/types.js";
import { registerStageHandlers } from "./index.js";
import { getStage, resetStageRegistry, type StageContext } from "./registry.js";
import { mitigationSynthesizerStage } from "./mitigation-synthesizer.js";

const STUB_LIST = [
  {
    description: "Enforce parameterized queries",
    controlCategory: "INPUT_VALIDATION",
    testCriteria: "Confirm that all queries use bound parameters",
    effort: "MEDIUM",
    effectiveness: 0.7,
    suggestedRequirement: null,
  },
  {
    description: "Apply least-privilege DB accounts",
    controlCategory: "IAM",
    testCriteria: "Verify that app accounts lack DDL rights",
    effort: "LOW",
    effectiveness: 0.5,
    suggestedRequirement: null,
  },
];

/** Answers a batch prompt the stub list for every "### Threat N". */
const stubMitigations = async (_system: string, user: string) =>
  JSON.stringify(
    [...user.matchAll(/### Threat (\d+)/g)].map(([, n]) => ({
      threat: Number(n),
      mitigations: STUB_LIST,
    })),
  );

const MITIGATIONS_ONLY = { mitigationsOnly: true } as const;

const componentContexts: ComponentContext[] = [
  {
    id: "web",
    name: "Web App",
    type: "WEB_APP",
    dataClassification: "INTERNAL",
    dataTypes: [],
    accessPattern: "INTERNAL_ONLY",
    complianceFrameworks: [],
    existingControls: [],
    inbound: [],
    outbound: [],
  },
];

function threat(overrides: Partial<MicroThreat> = {}): MicroThreat {
  return {
    name: "Stub threat",
    description: "desc",
    category: "TAMPERING",
    severity: "MEDIUM",
    componentId: "web",
    componentName: "Web App",
    cweIds: ["CWE-89"],
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
    aiCall: aiCall ?? stubMitigations,
    progress: async () => undefined,
    checkpoint: async () => undefined,
    signal: new AbortController().signal,
  };
}

describe("MitigationSynthesizer stage handler", () => {
  beforeEach(() => {
    resetStageRegistry();
  });

  it("registers via stages/index.ts side-effect registration", () => {
    expect(() => getStage("MitigationSynthesizer")).toThrowError(
      /not registered/,
    );
    registerStageHandlers();
    expect(getStage("MitigationSynthesizer")).toBe(mitigationSynthesizerStage);
  });

  it("defers mitigations to finalize outside mitigations-only mode: no LLM calls, order kept", async () => {
    let calls = 0;
    const threats = [
      threat({ name: "Loop threat" }),
      threat({ name: "Supply chain", sourceMethodology: "supply_chain" }),
      threat({ name: "Second loop threat" }),
    ];
    const result = await mitigationSynthesizerStage(
      makeCtx({ threats, componentContexts }, async (system, user) => {
        calls++;
        return stubMitigations(system, user);
      }),
    );
    expect(calls).toBe(0);
    expect(result.outputs.llmCalls).toBe(0);
    const out = result.outputs.threatsWithMitigations as MicroThreat[];
    expect(out.map((t) => t.name)).toEqual([
      "Loop threat",
      "Second loop threat",
      "Supply chain",
    ]);
    for (const t of out) expect(t.mitigations).toEqual([]);
  });

  it("mitigations-only mode: generates mitigations via mitigation-analyzer (one call per batch)", async () => {
    let calls = 0;
    const threats = [threat({ name: "T1" }), threat({ name: "T2" })];
    const result = await mitigationSynthesizerStage(
      makeCtx(
        { threats, componentContexts, options: MITIGATIONS_ONLY },
        async (system, user) => {
          calls++;
          return stubMitigations(system, user);
        },
      ),
    );

    expect(calls).toBe(1);
    expect(result.outputs.llmCalls).toBe(1);
    const out = result.outputs.threatsWithMitigations as MicroThreat[];
    expect(out).toHaveLength(2);
    for (const t of out) {
      expect(t.mitigations).toHaveLength(2);
      expect(t.mitigations.map((m) => m.controlCategory)).toEqual([
        "INPUT_VALIDATION",
        "IAM",
      ]);
      // Legacy mitigation field mirrors the first mitigation
      expect(t.mitigation.description).toBe("Enforce parameterized queries");
    }
  });

  it("prefers classifiedThreats over threats when StrideClassifier ran", async () => {
    const enriched = [threat({ name: "Enriched only" })];
    const classified = [threat({ name: "Classified", category: "SPOOFING" })];
    const result = await mitigationSynthesizerStage(
      makeCtx({
        threats: enriched,
        classifiedThreats: classified,
        componentContexts,
      }),
    );
    const out = result.outputs.threatsWithMitigations as MicroThreat[];
    expect(out.map((t) => t.name)).toEqual(["Classified"]);
  });

  it("mitigations-only mode: passes supplemental + compound threats through without LLM calls, after the mitigated set (legacy order)", async () => {
    let calls = 0;
    const threats = [
      threat({ name: "Loop threat" }),
      threat({
        name: "Supply chain",
        componentId: "web",
        sourceMethodology: "supply_chain",
      }),
      threat({
        name: "Chained attack",
        componentId: "compound",
        sourceMethodology: "compound",
      }),
    ];
    const result = await mitigationSynthesizerStage(
      makeCtx(
        { threats, componentContexts, options: MITIGATIONS_ONLY },
        async (system, user) => {
          calls++;
          return stubMitigations(system, user);
        },
      ),
    );

    expect(calls).toBe(1); // only the loop threat
    const out = result.outputs.threatsWithMitigations as MicroThreat[];
    expect(out.map((t) => t.name)).toEqual([
      "Loop threat",
      "Supply chain",
      "Chained attack",
    ]);
    expect(out[1].mitigations).toEqual([]); // untouched pass-through
  });

  it("mitigations-only mode: passes threats with unknown componentId through unchanged (legacy !compCtx branch)", async () => {
    let calls = 0;
    const threats = [threat({ name: "Orphan", componentId: "ghost" })];
    const result = await mitigationSynthesizerStage(
      makeCtx(
        { threats, componentContexts, options: MITIGATIONS_ONLY },
        async (system, user) => {
          calls++;
          return stubMitigations(system, user);
        },
      ),
    );
    expect(calls).toBe(0);
    expect(
      (result.outputs.threatsWithMitigations as MicroThreat[])[0].mitigations,
    ).toEqual([]);
  });

  it("requires inputs.threats (or classifiedThreats)", async () => {
    await expect(mitigationSynthesizerStage(makeCtx({}))).rejects.toThrowError(
      /requires inputs\.threats/,
    );
  });
});
