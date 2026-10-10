/**
 * shared mitigation pass (legacy pipeline + v2 finalize).
 *
 * Mitigates only the identification threats, batched per component, and
 * replaces them in place so the set's order is unchanged — the property that
 * keeps the legacy-recorded journal valid for the v2 path.
 */
import { describe, it, expect } from "vitest";
import type { ComponentContext } from "../../../threat-generation/context-aware-pipeline.js";
import { MITIGATION_BATCH_SIZE } from "../mitigation-analyzer.js";
import { mitigationKey, runMitigationPass } from "../mitigation-pass.js";
import type { MicroThreat, ParseFailure } from "../types.js";

const STUB_LIST = [
  {
    description: "Enforce parameterized queries",
    controlCategory: "INPUT_VALIDATION",
    testCriteria: "Confirm that all queries use bound parameters",
    effort: "MEDIUM",
    effectiveness: 0.7,
    suggestedRequirement: null,
  },
];

function context(id: string): ComponentContext {
  return {
    id,
    name: `Component ${id}`,
    type: "WEB_APP",
    dataClassification: "INTERNAL",
    dataTypes: [],
    accessPattern: "INTERNAL_ONLY",
    complianceFrameworks: [],
    existingControls: [],
    inbound: [],
    outbound: [],
  };
}

function threat(overrides: Partial<MicroThreat> = {}): MicroThreat {
  return {
    name: "Stub threat",
    description: "desc",
    category: "TAMPERING",
    severity: "MEDIUM",
    componentId: "a",
    componentName: "Component a",
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

/** Answers a batch prompt with the stub list for every "### Threat N". */
function recordingCaller(prompts: string[]) {
  return async (_system: string, user: string) => {
    prompts.push(user);
    return JSON.stringify(
      [...user.matchAll(/### Threat (\d+)/g)].map(([, n]) => ({
        threat: Number(n),
        mitigations: STUB_LIST,
      })),
    );
  };
}

describe("runMitigationPass", () => {
  it("mitigates only identification threats and keeps the set's order", async () => {
    const prompts: string[] = [];
    const threats = [
      threat({ name: "A1" }),
      threat({ name: "Supply", sourceMethodology: "supply_chain" }),
      threat({ name: "B1", componentId: "b" }),
      threat({ name: "A2" }),
    ];
    const result = await runMitigationPass({
      aiCall: recordingCaller(prompts),
      threats,
      isIdentification: (t) => t.sourceMethodology !== "supply_chain",
      componentContexts: [context("a"), context("b")],
      parseFailures: [],
      report: () => {},
    });

    expect(threats.map((t) => t.name)).toEqual(["A1", "Supply", "B1", "A2"]);
    expect(threats[0].mitigations).toHaveLength(1);
    expect(threats[1].mitigations).toEqual([]); // not an identification threat
    expect(threats[2].mitigations).toHaveLength(1);
    expect(threats[3].mitigations).toHaveLength(1);
    expect(result).toEqual({ mitigatedCount: 3, llmCalls: 2 }); // one batch per component
    expect(prompts).toHaveLength(2);
  });

  it("splits a component's threats into MITIGATION_BATCH_SIZE batches", async () => {
    const prompts: string[] = [];
    const count = MITIGATION_BATCH_SIZE * 2 + 1;
    const threats = Array.from({ length: count }, (_, i) =>
      threat({ name: `T${i}` }),
    );
    const result = await runMitigationPass({
      aiCall: recordingCaller(prompts),
      threats,
      isIdentification: () => true,
      componentContexts: [context("a")],
      parseFailures: [],
      report: () => {},
    });

    expect(result.llmCalls).toBe(3);
    expect(prompts).toHaveLength(3);
    for (const t of threats) expect(t.mitigations).toHaveLength(1);
  });

  it("skips threats whose component has no context (legacy !compCtx branch)", async () => {
    const prompts: string[] = [];
    const threats = [threat({ name: "Orphan", componentId: "ghost" })];
    const result = await runMitigationPass({
      aiCall: recordingCaller(prompts),
      threats,
      isIdentification: () => true,
      componentContexts: [context("a")],
      parseFailures: [] as ParseFailure[],
      report: () => {},
    });

    expect(prompts).toHaveLength(0);
    expect(result).toEqual({ mitigatedCount: 0, llmCalls: 0 });
    expect(threats[0].mitigations).toEqual([]);
  });

  it("reports start and done, as the legacy block did", async () => {
    const phases: string[] = [];
    await runMitigationPass({
      aiCall: recordingCaller([]),
      threats: [threat()],
      isIdentification: () => true,
      componentContexts: [context("a")],
      parseFailures: [],
      report: (phase) => phases.push(phase),
    });
    expect(phases[0]).toBe("mitigations");
    expect(phases[phases.length - 1]).toBe("mitigations_done");
  });
});

describe("mitigationKey", () => {
  it("keys a threat by component and name", () => {
    expect(mitigationKey(threat({ componentId: "c", name: "N" }))).toBe("c::N");
  });
});
