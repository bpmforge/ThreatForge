/**
 * SeverityCalibrator stage handler unit tests. DB-free: no persist →
 * EPSS gate stays off. Wraps the real
 * micro-analysis/severity-calibrator + llm-dedup modules with a stubbed
 * aiCall that answers the calibration and dedup prompts distinctly.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { AttackChain } from "../../threat-generation/attack-chain-analyzer.js";
import type { MicroThreat } from "../micro-analysis/types.js";
import { registerStageHandlers } from "./index.js";
import { getStage, resetStageRegistry, type StageContext } from "./registry.js";
import { severityCalibratorStage } from "./severity-calibrator.js";

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
  aiCall: StageContext["aiCall"],
): StageContext {
  return {
    executionId: "exec-1",
    threatModelId: "tm-1",
    organizationId: "org-1",
    sessionId: "session-1",
    inputs,
    aiCall,
    progress: async () => undefined,
    checkpoint: async () => undefined,
    signal: new AbortController().signal,
  };
}

/** Singleton clusters for a dedup prompt over n threats (keeps everything). */
function singletonClusters(n: number): string {
  return JSON.stringify(
    Array.from({ length: n }, (_, i) => ({ indices: [i] })),
  );
}

describe("SeverityCalibrator stage handler", () => {
  beforeEach(() => {
    resetStageRegistry();
  });

  it("registers via stages/index.ts side-effect registration", () => {
    expect(() => getStage("SeverityCalibrator")).toThrowError(/not registered/);
    registerStageHandlers();
    expect(getStage("SeverityCalibrator")).toBe(severityCalibratorStage);
  });

  it("bumps severity for threats on attack-chain components (rule-based, no LLM under 5 threats)", async () => {
    let llmCalls = 0;
    const threats = [
      threat({ name: "On chain", componentId: "web", severity: "MEDIUM" }),
      threat({ name: "Off chain", componentId: "db", severity: "MEDIUM" }),
    ];
    const attackChains = [
      { steps: [{ componentId: "web" }] },
    ] as unknown as AttackChain[];

    const result = await severityCalibratorStage(
      makeCtx({ threats, attackChains }, async () => {
        llmCalls++;
        return "[]";
      }),
    );

    expect(llmCalls).toBe(0); // <5 threats → no calibration call; singleton groups → no dedup calls
    const out = result.outputs.calibratedThreats as MicroThreat[];
    expect(out.find((t) => t.name === "On chain")?.severity).toBe("HIGH");
    expect(out.find((t) => t.name === "Off chain")?.severity).toBe("MEDIUM");
  });

  it("dedups same name+component keeping the highest severity", async () => {
    const threats = [
      threat({ name: "Dup threat", severity: "LOW" }),
      threat({ name: "Dup threat", severity: "HIGH" }),
    ];
    const result = await severityCalibratorStage(
      makeCtx({ threats }, async () => "[]"),
    );
    const out = result.outputs.calibratedThreats as MicroThreat[];
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe("HIGH");
  });

  it("applies LLM calibration adjustments (≥5 threats) and runs the dedup tail", async () => {
    const threats = Array.from({ length: 5 }, (_, i) =>
      threat({ name: `T${i}`, severity: "MEDIUM" }),
    );
    const prompts: string[] = [];
    const result = await severityCalibratorStage(
      makeCtx({ threats }, async (system) => {
        prompts.push(system);
        if (system.includes("review threat severities")) {
          return JSON.stringify([{ name: "T0", severity: "CRITICAL" }]);
        }
        // dedup prompt — keep all as singletons
        return singletonClusters(5);
      }),
    );

    // 1 calibration call + 1 dedup call (single component group of 5)
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("paraphrase duplicates");
    const out = result.outputs.calibratedThreats as MicroThreat[];
    expect(out).toHaveLength(5);
    expect(out.find((t) => t.name === "T0")?.severity).toBe("CRITICAL");
    // Sorted by severity — the CRITICAL adjustment comes first
    expect(out[0].name).toBe("T0");
  });

  it("keeps the calibrated set when the dedup response is malformed (non-load-bearing)", async () => {
    const threats = [
      threat({ name: "A", severity: "LOW" }),
      threat({ name: "B", severity: "LOW" }),
    ];
    const result = await severityCalibratorStage(
      makeCtx({ threats }, async () => "not json"),
    );
    const out = result.outputs.calibratedThreats as MicroThreat[];
    expect(out.map((t) => t.name).sort()).toEqual(["A", "B"]);
  });

  it("requires inputs.threats", async () => {
    await expect(
      severityCalibratorStage(makeCtx({}, async () => "[]")),
    ).rejects.toThrowError(/requires inputs\.threats/);
  });
});
