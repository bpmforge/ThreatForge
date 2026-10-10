/**
 * The duplicate guard runs inside floorAndMitigateV2Final (v2 tail), and is
 * skipped in mitigations-only mode, where the set is existing DB rows being
 * re-mitigated — merging two of them would silently skip one's refresh.
 */
import { describe, it, expect } from "vitest";
import { floorAndMitigateV2Final } from "../suggest-threats-v2-finalize.js";
import type { MicroThreat } from "../../services/ai/micro-analysis/types.js";
import type { ThreatModelContext } from "../../types/ai.js";

function threat(name: string): MicroThreat {
  return {
    name,
    description: "",
    category: "TAMPERING",
    severity: "HIGH",
    componentId: "comp-a",
    componentName: "API Gateway",
    cweIds: ["CWE-347"],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "", effectiveness: "" },
    confidence: 0.9,
    sourceMethodology: "stride",
  };
}

const pair = () => [
  threat("JWT Signature Bypass via Algorithm Confusion"),
  threat("JWT Signature Verification Bypass via Algorithm Confusion"),
  threat("Unbounded Queue Growth and Memory Exhaustion"),
];
const context = {
  components: [],
  requirements: [],
} as unknown as ThreatModelContext;

describe("floorAndMitigateV2Final — duplicate guard", () => {
  it("merges a merge-band pair before persist", async () => {
    const r = await floorAndMitigateV2Final({
      threats: pair(),
      context,
      parseFailures: [],
      report: () => {},
    });
    expect(r.kept).toHaveLength(2);
    expect(r.guard.metrics.merged).toBe(1);
  });

  it("leaves the set alone in mitigations-only mode", async () => {
    const r = await floorAndMitigateV2Final({
      threats: pair(),
      context,
      skipDuplicateGuard: true,
      parseFailures: [],
      report: () => {},
    });
    expect(r.kept).toHaveLength(3);
    expect(r.guard.metrics.merged).toBe(0);
  });
});
