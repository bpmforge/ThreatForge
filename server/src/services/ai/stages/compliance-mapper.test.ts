/**
 * ComplianceMapper stage handler unit tests. Non-LLM, NON-MUTATING
 * (documented decision: the legacy pipeline has no compliance stage, so the
 * threat set must pass through unchanged); the mapping itself rides along
 * as controlMatches, computed from the real framework control catalogs.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { ComponentContext } from "../../threat-generation/context-aware-pipeline.js";
import type { MicroThreat } from "../micro-analysis/types.js";
import {
  complianceMapperStage,
  normalizeFrameworkId,
  type ControlMatch,
} from "./compliance-mapper.js";
import { registerStageHandlers } from "./index.js";
import { getStage, resetStageRegistry, type StageContext } from "./registry.js";

function threat(overrides: Partial<MicroThreat> = {}): MicroThreat {
  return {
    name: "Weak authentication on admin endpoint",
    description: "Missing multi-factor authentication allows account takeover",
    category: "SPOOFING",
    severity: "HIGH",
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

function component(frameworks: string[]): ComponentContext {
  return {
    id: "web",
    name: "Web App",
    type: "WEB_APP",
    dataClassification: "INTERNAL",
    dataTypes: [],
    accessPattern: "INTERNAL_ONLY",
    complianceFrameworks: frameworks,
    existingControls: [],
    inbound: [],
    outbound: [],
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
      throw new Error("ComplianceMapper must not call the LLM");
    },
    progress: async () => undefined,
    checkpoint: async () => undefined,
    signal: new AbortController().signal,
  };
}

describe("ComplianceMapper stage handler", () => {
  beforeEach(() => {
    resetStageRegistry();
  });

  it("registers via stages/index.ts side-effect registration", () => {
    expect(() => getStage("ComplianceMapper")).toThrowError(/not registered/);
    registerStageHandlers();
    expect(getStage("ComplianceMapper")).toBe(complianceMapperStage);
  });

  it("normalizes framework names to catalog ids", () => {
    expect(normalizeFrameworkId("PCI-DSS")).toBe("PCI_DSS");
    expect(normalizeFrameworkId("soc2")).toBe("SOC2");
    expect(normalizeFrameworkId("nist 800-53")).toBe("NIST_800_53");
  });

  it("passes threats through unchanged and emits control matches", async () => {
    const threats = [threat()];
    const result = await complianceMapperStage(
      makeCtx({
        threats,
        componentContexts: [component(["SOC2", "PCI-DSS"])],
      }),
    );

    expect(result.outputs.complianceMappedThreats).toBe(threats); // identity
    const matches = result.outputs.controlMatches as ControlMatch[];
    expect(matches.length).toBeGreaterThan(0);
    // SPOOFING + "authentication"/"multi-factor" keywords match real controls
    const frameworks = new Set(matches.map((m) => m.framework));
    expect(frameworks.has("SOC2")).toBe(true);
    expect(frameworks.has("PCI_DSS")).toBe(true);
    for (const m of matches) {
      expect(m.controlIds.length).toBeGreaterThan(0);
      expect(m.threatName).toBe(threats[0].name);
    }
    expect(result.tokensUsed).toBe(0);
  });

  it("skips unknown frameworks and yields no matches without frameworks", async () => {
    const threats = [threat()];
    const unknown = await complianceMapperStage(
      makeCtx({
        threats,
        componentContexts: [component(["NOT_A_FRAMEWORK"])],
      }),
    );
    expect(unknown.outputs.controlMatches).toEqual([]);

    const none = await complianceMapperStage(
      makeCtx({ threats, componentContexts: [component([])] }),
    );
    expect(none.outputs.controlMatches).toEqual([]);
    expect(none.outputs.complianceMappedThreats).toBe(threats);
  });

  it("requires inputs.threats", async () => {
    await expect(complianceMapperStage(makeCtx({}))).rejects.toThrowError(
      /requires inputs\.threats/,
    );
  });
});
