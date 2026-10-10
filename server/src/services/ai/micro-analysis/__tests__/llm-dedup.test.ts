/**
 * LLM semantic dedup is NON-LOAD-BEARING. That's the whole point.
 * If the LLM throws, returns garbage, or forgets threats, the pipeline
 * must return the original set unchanged. Losing good threats to a bad
 * LLM response would be worse than the duplicates dedup is trying to fix.
 *
 * These tests lock in the "do no harm" contract:
 *   dedup-3: LLM throws → original set returned
 *   dedup-4: LLM returns malformed JSON → original set returned
 *   dedup-9: LLM forgets some indices → they come back as singletons
 */
import { describe, it, expect, vi } from "vitest";
import { dedupThreatsViaLLM } from "../llm-dedup.js";
import type { MicroThreat } from "../types.js";

vi.mock("../../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function makeThreat(
  name: string,
  componentId: string,
  confidence = 0.7,
  description = "",
): MicroThreat {
  return {
    name,
    description,
    category: "TAMPERING",
    severity: "HIGH",
    componentId,
    componentName: "Test",
    cweIds: [],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "low", effectiveness: "0.5" },
    confidence,
    sourceMethodology: "stride",
  };
}

describe("dedupThreatsViaLLM — fail-safe guarantees", () => {
  it("dedup-3: LLM throws → original set returned unchanged", async () => {
    const threats = [
      makeThreat("A", "c1"),
      makeThreat("B", "c1"),
      makeThreat("C", "c1"),
    ];
    const aiCall = vi.fn().mockRejectedValue(new Error("LLM crashed"));

    const result = await dedupThreatsViaLLM(aiCall, threats);

    expect(result).toHaveLength(3);
    expect(result.map((t) => t.name)).toEqual(["A", "B", "C"]);
  });

  it("dedup-4: LLM returns non-JSON → original set returned", async () => {
    const threats = [makeThreat("A", "c1"), makeThreat("B", "c1")];
    const aiCall = vi.fn().mockResolvedValue("this is not json at all");

    const result = await dedupThreatsViaLLM(aiCall, threats);

    expect(result).toHaveLength(2);
  });

  it("dedup-4b: LLM returns empty JSON array → original set returned", async () => {
    const threats = [makeThreat("A", "c1"), makeThreat("B", "c1")];
    const aiCall = vi.fn().mockResolvedValue("[]");

    const result = await dedupThreatsViaLLM(aiCall, threats);

    expect(result).toHaveLength(2);
  });

  it("dedup-9: LLM forgets an index → it comes back as a singleton", async () => {
    // 4 threats; LLM clusters only [0, 1] and forgets 2 and 3.
    // Result MUST contain: cluster rep for [0,1] + t2 + t3 as singletons.
    const threats = [
      makeThreat("A", "c1", 0.8),
      makeThreat("A paraphrase", "c1", 0.7),
      makeThreat("C forgotten", "c1", 0.9),
      makeThreat("D forgotten", "c1", 0.6),
    ];
    const aiCall = vi.fn().mockResolvedValue('[{"indices":[0,1]}]');

    const result = await dedupThreatsViaLLM(aiCall, threats);

    expect(result).toHaveLength(3);
    const names = result.map((t) => t.name);
    // "A" wins the cluster (confidence 0.8 vs 0.7)
    expect(names).toContain("A");
    // Forgotten threats survive as singletons
    expect(names).toContain("C forgotten");
    expect(names).toContain("D forgotten");
  });

  it("cluster rep: highest confidence wins", async () => {
    const threats = [
      makeThreat("A", "c1", 0.6),
      makeThreat("B", "c1", 0.95),
      makeThreat("C", "c1", 0.7),
    ];
    const aiCall = vi.fn().mockResolvedValue('[{"indices":[0,1,2]}]');

    const result = await dedupThreatsViaLLM(aiCall, threats);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("B"); // highest confidence
  });

  it("cluster rep: longer description breaks confidence tie", async () => {
    const threats = [
      makeThreat("Short", "c1", 0.8, "short desc"),
      makeThreat("Long", "c1", 0.8, "much longer and more detailed desc"),
    ];
    const aiCall = vi.fn().mockResolvedValue('[{"indices":[0,1]}]');

    const result = await dedupThreatsViaLLM(aiCall, threats);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Long");
  });

  it("<2 threats returns unchanged without LLM call", async () => {
    const aiCall = vi.fn();

    const one = await dedupThreatsViaLLM(aiCall, [makeThreat("A", "c1")]);
    expect(one).toHaveLength(1);

    const none = await dedupThreatsViaLLM(aiCall, []);
    expect(none).toHaveLength(0);

    expect(aiCall).not.toHaveBeenCalled();
  });

  it("an ml_threat template never outranks a real finding — cluster is skipped, not merged", async () => {
    // The ML-template threat carries a higher fixed confidence (0.8) than a
    // real LLM-found threat (0.7) purely because it's a template, not
    // because it's more likely correct. If confidence ordering alone picks
    // the winner, the genuine finding is silently discarded. Default:
    // skip merging (keep both) and log, rather than let the template win.
    const threats = [
      makeThreat("Generic ML model threat", "c1", 0.8),
      makeThreat("SQL injection via unsanitized input", "c1", 0.7),
    ];
    threats[0].sourceMethodology = "ml_threat";
    const aiCall = vi.fn().mockResolvedValue('[{"indices":[0,1]}]');

    const result = await dedupThreatsViaLLM(aiCall, threats);

    // Both survive — the template did not silently delete the real finding.
    expect(result).toHaveLength(2);
    const names = result.map((t) => t.name);
    expect(names).toContain("Generic ML model threat");
    expect(names).toContain("SQL injection via unsanitized input");
  });

  it("cross-component threats are clustered independently", async () => {
    // 4 threats — 2 on c1, 2 on c2. Even if they're paraphrases across
    // components, they must NOT merge because the groups are isolated.
    const threats = [
      makeThreat("A1", "c1"),
      makeThreat("A2", "c1"),
      makeThreat("B1", "c2"),
      makeThreat("B2", "c2"),
    ];
    // Each per-component call merges its pair.
    const aiCall = vi.fn().mockResolvedValue('[{"indices":[0,1]}]');

    const result = await dedupThreatsViaLLM(aiCall, threats);

    // Expect 2 results — one per component group.
    expect(result).toHaveLength(2);
    const components = new Set(result.map((t) => t.componentId));
    expect(components).toEqual(new Set(["c1", "c2"]));
  });
});

describe("dedupThreatsViaLLM — class-grain rule and collapse bound", () => {
  it("tells the model to merge variants one mitigation closes", async () => {
    const threats = [makeThreat("A", "c1"), makeThreat("B", "c1")];
    const aiCall = vi
      .fn()
      .mockResolvedValue('[{"indices":[0]},{"indices":[1]}]');
    await dedupThreatsViaLLM(aiCall, threats);
    expect(aiCall.mock.calls[0][0]).toMatch(/single mitigation would close/);
  });

  it("caps how many threats one cluster may absorb", async () => {
    const threats = Array.from({ length: 8 }, (_, i) =>
      makeThreat(`T${i}`, "c1", 0.9 - i * 0.01),
    );
    const aiCall = vi.fn().mockResolvedValue(`[{"indices":[0,1,2,3,4,5,6,7]}]`);
    const result = await dedupThreatsViaLLM(aiCall, threats);
    // Top MAX_CLUSTER_SIZE (5) collapse to one winner; the 3 overflow survive.
    expect(result).toHaveLength(4);
    expect(result.map((t) => t.name)).toContain("T0");
    expect(result.map((t) => t.name)).toContain("T7");
  });
});
