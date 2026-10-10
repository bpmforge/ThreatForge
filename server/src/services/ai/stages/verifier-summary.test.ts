import { describe, it, expect } from "vitest";
import type { ThreatModelContext } from "../../../types/ai.js";
import type { MicroThreat } from "../micro-analysis/types.js";
import { buildVerifierUserPrompt } from "../prompts/verifier.js";
import { summarize, toLine } from "./verifier.js";

const ctx: ThreatModelContext = {
  name: "m",
  components: [
    { id: "c1", name: "Web", type: "SERVICE", trustZone: "DMZ" },
    { id: "c2", name: "DB", type: "DATABASE", trustZone: "INTERNAL" },
  ],
  connections: [
    {
      id: "e1",
      source: "c1",
      target: "c2",
      label: "queries",
      protocol: "TCP",
      encrypted: true,
      authentication: "MTLS",
    },
  ],
  boundaries: [{ id: "b1", name: "Prod VPC", trustLevel: "HIGH" }],
};

describe("verifier summary", () => {
  it("renders auth, boundary crossings, endpoint names and trust boundaries without ids", () => {
    const out = summarize(ctx);
    expect(out).toContain("(Web -> DB)");
    expect(out).toContain("auth=MTLS");
    expect(out).toContain("CROSSES TRUST BOUNDARY");
    expect(out).toContain("Prod VPC (HIGH)");
    expect(out).not.toContain("c1");
  });

  it("carries CWE ids from the threat into the prompt", () => {
    const line = toLine({
      name: "t",
      category: "TAMPERING",
      componentName: "Web",
      description: "d",
      cweIds: ["CWE-89"],
    } as unknown as MicroThreat);
    expect(buildVerifierUserPrompt("arch", [line])).toContain("cwe: CWE-89");
  });
});
