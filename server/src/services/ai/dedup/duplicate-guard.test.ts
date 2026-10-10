import { describe, it, expect, vi } from "vitest";
import type { MicroThreat } from "../micro-analysis/types.js";
import { runDuplicateGuard, LLM_ACCEPT_FLOOR } from "./duplicate-guard.js";

function threat(over: Partial<MicroThreat> & { name: string }): MicroThreat {
  return {
    description: "",
    category: "SPOOFING",
    severity: "MEDIUM",
    componentId: "comp-a",
    componentName: "Component A",
    cweIds: [],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "", effectiveness: "" },
    confidence: 0.7,
    sourceMethodology: "stride",
    ...over,
  };
}

const mit = (description: string) => ({
  description,
  controlCategory: "ACCESS_CONTROL",
  testCriteria: "",
  effort: "LOW",
  effectiveness: "0.7",
});

describe("runDuplicateGuard", () => {
  it("merges a merge-band pair, keeping the more specific threat and unioning evidence", async () => {
    const r = await runDuplicateGuard([
      threat({
        name: "JWT Signature Bypass via Algorithm Confusion",
        category: "TAMPERING",
        cweIds: ["CWE-347"],
        severity: "HIGH",
        mitigations: [mit("Pin the accepted JWT algorithm to RS256.")],
      }),
      threat({
        name: "JWT Signature Verification Bypass via Algorithm Confusion",
        description:
          "Kong accepts tokens whose alg header is switched to HS256, signed with the public key.",
        cweIds: ["CWE-347", "CWE-327"],
        severity: "CRITICAL",
        evidence: { attackPath: "forge token -> gateway accepts" },
        mitigations: [mit("Reject tokens whose alg is not RS256.")],
      }),
    ]);
    expect(r.threats).toHaveLength(1);
    const [survivor] = r.threats;
    expect(survivor.name).toBe(
      "JWT Signature Verification Bypass via Algorithm Confusion",
    );
    expect(survivor.severity).toBe("CRITICAL");
    expect(survivor.cweIds.sort()).toEqual(["CWE-327", "CWE-347"]);
    expect(survivor.mitigations).toHaveLength(2);
    expect(survivor.evidence.mergedDuplicates?.[0].name).toBe(
      "JWT Signature Bypass via Algorithm Confusion",
    );
    expect(r.merges).toHaveLength(1);
    expect(r.merges[0].via).toBe("detector");
    expect(r.metrics.merged).toBe(1);
    expect(r.metrics.threatsIn).toBe(2);
  });

  it("never lets a template survive over a real finding", async () => {
    const r = await runDuplicateGuard([
      threat({
        name: "Model Poisoning via Unvalidated Training Data",
        sourceMethodology: "ml_threat",
        confidence: 0.8,
        cweIds: ["CWE-20", "CWE-345"],
        description: "x".repeat(400),
      }),
      threat({
        name: "Model Poisoning via Unvalidated Training Data Uploads",
        confidence: 0.6,
      }),
    ]);
    expect(r.threats).toHaveLength(1);
    expect(r.threats[0].sourceMethodology).toBe("stride");
  });

  it("records review-band pairs on both threats and in the result, without merging", async () => {
    const r = await runDuplicateGuard([
      threat({
        name: "Log Injection via Unsanitized Input",
        componentId: "comp-a",
        category: "REPUDIATION",
        cweIds: ["CWE-117"],
      }),
      threat({
        name: "Log Injection via Unsanitized Input",
        componentId: "comp-b",
        componentName: "Component B",
        category: "REPUDIATION",
        cweIds: ["CWE-117"],
      }),
    ]);
    expect(r.threats).toHaveLength(2);
    expect(r.reviewPairs).toHaveLength(1);
    expect(r.threats[0].evidence.possibleDuplicates?.[0].componentId).toBe(
      "comp-b",
    );
    expect(r.threats[1].evidence.possibleDuplicates?.[0].componentId).toBe(
      "comp-a",
    );
    expect(r.metrics.duplicateRateAfter).toBeGreaterThan(0);
  });

  it("asks the LLM only about same-target review pairs above the floor, and verifies its answer", async () => {
    const a = threat({
      name: "Redis Connection Spoofing via Unencrypted API Key",
      category: "SPOOFING",
    });
    const b = threat({
      name: "Redis Cache Integrity Bypass via Unencrypted API Key",
      category: "TAMPERING",
    });
    const unrelated = threat({
      name: "Unbounded Queue Growth and Memory Exhaustion",
      category: "DENIAL_OF_SERVICE",
    });
    const aiCall = vi.fn(async (_system: string, user: string) => {
      // The LLM clusters everything it is shown into one group.
      const n = (user.match(/^\d+\. /gm) ?? []).length;
      return JSON.stringify([{ indices: [...Array(n).keys()] }]);
    });
    const r = await runDuplicateGuard([a, b, unrelated], { aiCall });
    expect(aiCall).toHaveBeenCalledTimes(1);
    const shown = aiCall.mock.calls[0][1];
    expect(shown).toContain("Redis Connection Spoofing");
    expect(shown).not.toContain("Unbounded Queue Growth");
    expect(r.threats).toHaveLength(2);
    expect(r.merges[0].via).toBe("llm");
    expect(r.merges[0].score).toBeGreaterThanOrEqual(LLM_ACCEPT_FLOOR);
  });

  it("an LLM failure leaves the pairs in review and does not throw", async () => {
    const aiCall = vi.fn(async () => {
      throw new Error("ReplayMiss");
    });
    const r = await runDuplicateGuard(
      [
        threat({ name: "Redis Connection Spoofing via Unencrypted API Key" }),
        threat({
          name: "Redis Cache Integrity Bypass via Unencrypted API Key",
          category: "TAMPERING",
        }),
        threat({
          name: "Unbounded Queue Growth and Memory Exhaustion",
          category: "DENIAL_OF_SERVICE",
        }),
      ],
      { aiCall },
    );
    expect(r.threats).toHaveLength(3);
    expect(r.reviewPairs).toHaveLength(1);
    expect(r.metrics.llmCalls).toBe(1);
  });

  it("drops restated mitigations within a threat and groups a control shared across threats", async () => {
    const control = "Use parameterized queries for every database write.";
    const r = await runDuplicateGuard([
      threat({
        name: "SQL Injection in Order Persistence",
        componentId: "comp-order",
        category: "TAMPERING",
        mitigations: [
          mit(control),
          mit("Use parameterized queries for every database write"),
        ],
      }),
      threat({
        name: "Unbounded Queue Growth and Memory Exhaustion",
        componentId: "comp-broker",
        category: "DENIAL_OF_SERVICE",
        mitigations: [
          mit("Use parameterized queries for all database writes."),
        ],
      }),
    ]);
    expect(r.threats[0].mitigations).toHaveLength(1);
    expect(r.metrics.droppedDuplicateMitigations).toBe(1);
    expect(r.controlGroups).toHaveLength(1);
    expect(r.controlGroups[0].threats.map((t) => t.componentId).sort()).toEqual(
      ["comp-broker", "comp-order"],
    );
  });

  it("is a no-op on an empty or duplicate-free set", async () => {
    expect((await runDuplicateGuard([])).threats).toEqual([]);
    const r = await runDuplicateGuard([
      threat({ name: "SQL Injection in Invoice Queries", cweIds: ["CWE-89"] }),
      threat({
        name: "Cascading Failure from Missing Circuit Breakers",
        category: "DENIAL_OF_SERVICE",
        cweIds: ["CWE-400"],
      }),
    ]);
    expect(r.threats).toHaveLength(2);
    expect(r.metrics.merged).toBe(0);
    expect(r.metrics.duplicateRateAfter).toBe(0);
  });
});
