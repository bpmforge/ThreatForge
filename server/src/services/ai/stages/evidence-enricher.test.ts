/**
 * EvidenceEnricher stage handler unit tests. The stage is a verified
 * pass-through by design (reference enrichment is inseparable
 * from ThreatIdentifier's prompts — see handler doc), so the contract under
 * test is: identity pass-through + accurate referenceCoverage surfacing.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { MicroThreat } from "../micro-analysis/types.js";
import { evidenceEnricherStage } from "./evidence-enricher.js";
import { registerStageHandlers } from "./index.js";
import { getStage, resetStageRegistry, type StageContext } from "./registry.js";

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

function makeCtx(inputs: Record<string, unknown>): StageContext {
  return {
    executionId: "exec-1",
    threatModelId: "tm-1",
    organizationId: "org-1",
    sessionId: "session-1",
    inputs,
    aiCall: async () => {
      throw new Error("EvidenceEnricher must not call the LLM");
    },
    progress: async () => undefined,
    checkpoint: async () => undefined,
    signal: new AbortController().signal,
  };
}

describe("EvidenceEnricher stage handler", () => {
  beforeEach(() => {
    resetStageRegistry();
  });

  it("registers via stages/index.ts side-effect registration", () => {
    expect(() => getStage("EvidenceEnricher")).toThrowError(/not registered/);
    registerStageHandlers();
    expect(getStage("EvidenceEnricher")).toBe(evidenceEnricherStage);
  });

  it("passes threats through unchanged (same references, no LLM)", async () => {
    const threats = [
      threat({ cweIds: ["CWE-89"], evidence: { cwe: "CWE-89" } }),
      threat({ name: "Other", owaspIds: ["A03:2021"] }),
    ];
    const result = await evidenceEnricherStage(makeCtx({ threats }));

    expect(result.outputs.enrichedThreats).toBe(threats); // identity
    expect(result.outputs.parseFailures).toEqual([]);
    expect(result.tokensUsed).toBe(0);
  });

  it("surfaces reference coverage injected during identification", async () => {
    const threats = [
      threat({ cweIds: ["CWE-89"], evidence: { cwe: "CWE-89" } }),
      threat({ name: "B", owaspIds: ["A03:2021"] }),
      threat({ name: "C" }),
    ];
    const result = await evidenceEnricherStage(makeCtx({ threats }));

    expect(result.outputs.referenceCoverage).toEqual({
      total: 3,
      withCweIds: 1,
      withOwaspIds: 1,
      withEvidence: 1,
    });
  });

  it("requires inputs.threats", async () => {
    await expect(evidenceEnricherStage(makeCtx({}))).rejects.toThrowError(
      /requires inputs\.threats/,
    );
  });
});
