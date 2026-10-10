/**
 * the mitigation pass runs after LLM dedup and the confidence floor,
 * on the identification threats that survive them. A threat that dedup
 * merges away or the floor drops must not cost a mitigation call, and
 * compound threats keep their inline mitigation (no LLM mitigation pass).
 */
import { describe, it, expect, vi } from "vitest";
import { runMicroAnalysis } from "../pipeline.js";
import type { ThreatModelContext } from "../../../../types/ai.js";
import type { MicroThreat } from "../types.js";

vi.mock("../../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function makeThreat(
  name: string,
  componentId: string,
  confidence: number,
): MicroThreat {
  return {
    name,
    description: "d",
    category: "TAMPERING",
    severity: "HIGH",
    componentId,
    componentName: componentId,
    cweIds: [],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "MEDIUM", effectiveness: "0.5" },
    confidence,
    sourceMethodology: componentId === "compound" ? "compound" : "stride",
  };
}

vi.mock("../component-analyzer.js", () => ({
  analyzeComponent: vi.fn().mockResolvedValue({
    threats: [
      makeThreat("Keep", "comp-1", 0.8),
      makeThreat("Duplicate of Keep", "comp-1", 0.7),
      makeThreat("Below floor", "comp-1", 0.1),
    ],
    llmCalls: 1,
    parseFailures: [],
  }),
}));

vi.mock("../compound-analyzer.js", () => ({
  analyzeCompoundThreats: vi.fn().mockResolvedValue({
    attackChains: [],
    compoundThreats: [makeThreat("Chained", "compound", 0.8)],
    parseFailures: [],
  }),
}));

vi.mock("../severity-calibrator.js", () => ({
  calibrateSeverities: vi.fn((_ai, threats) => Promise.resolve(threats)),
}));

const dedup = vi.fn((_ai: unknown, threats: MicroThreat[]) =>
  Promise.resolve(threats.filter((t) => t.name !== "Duplicate of Keep")),
);
vi.mock("../llm-dedup.js", () => ({
  dedupThreatsViaLLM: (...args: [unknown, MicroThreat[]]) => dedup(...args),
}));

const mitigate = vi.fn((_ai: unknown, _comp: unknown, threats: MicroThreat[]) =>
  Promise.resolve(
    threats.map((t) => ({
      ...t,
      mitigations: [
        {
          description: `Control for ${t.name}`,
          controlCategory: "IAM",
          testCriteria: "Verify",
          effort: "LOW",
          effectiveness: "0.5",
        },
      ],
    })),
  ),
);
vi.mock("../mitigation-analyzer.js", () => ({
  generateMitigationsForComponent: (
    ...args: [unknown, unknown, MicroThreat[]]
  ) => mitigate(...args),
  MITIGATION_BATCH_SIZE: 3,
}));

const context: ThreatModelContext = {
  threatModelId: "model-1",
  components: [
    { id: "comp-1", name: "Component 1", type: "SERVICE", properties: {} },
  ],
  connections: [],
  sequenceFlows: [],
  requirements: [],
} as unknown as ThreatModelContext;

describe("runMicroAnalysis — mitigations after dedup + floor", () => {
  it("mitigates only identification threats that survive dedup and the floor", async () => {
    const result = await runMicroAnalysis(context, vi.fn(), {
      methodologies: ["stride"],
      retrySleep: async () => {},
    });

    expect(mitigate).toHaveBeenCalledTimes(1);
    expect(mitigate.mock.calls[0][2].map((t) => t.name)).toEqual(["Keep"]);
    expect(dedup.mock.invocationCallOrder[0]).toBeLessThan(
      mitigate.mock.invocationCallOrder[0],
    );

    const keep = result.threats.find((t) => t.name === "Keep");
    expect(keep?.mitigations[0].description).toBe("Control for Keep");
    expect(result.threats.map((t) => t.name)).not.toContain("Below floor");
    expect(result.compoundThreats.map((t) => t.name)).toEqual(["Chained"]);
    expect(result.compoundThreats[0].mitigations).toEqual([]);
  });
});
