import { describe, it, expect } from "vitest";
import { lookupCategoryReferences } from "../reference-lookup.js";
import type { ThreatResearch } from "../../../threat-generation/threat-research.js";

const emptyResearch: ThreatResearch = {
  owasp: [],
  cwes: [],
  cves: [],
  complianceRequirements: [],
};

describe("lookupCategoryReferences — OWASP and non-STRIDE maps", () => {
  it("renders mapped OWASP entries even when research lacks them", () => {
    const refs = lookupCategoryReferences(
      "SERVICE",
      "TAMPERING",
      emptyResearch,
      [],
    );
    expect(refs.owaspEntries.map((o) => o.id)).toEqual([
      "A03:2021",
      "A08:2021",
    ]);
    expect(refs.owaspEntries[0].name).toBe("Injection");
  });

  it("prefers the research entry when present", () => {
    const research: ThreatResearch = {
      ...emptyResearch,
      owasp: [{ id: "A03:2021", name: "X", description: "d", relevance: "r" }],
    };
    const refs = lookupCategoryReferences("SERVICE", "TAMPERING", research, []);
    expect(refs.owaspEntries[0].name).toBe("X");
  });

  it.each(["BUSINESS_LOGIC", "DELIVERY", "LATERAL_MOVEMENT", "IMPACT"])(
    "gives %s a non-empty, named CWE and OWASP section",
    (category) => {
      const refs = lookupCategoryReferences(
        "SERVICE",
        category,
        emptyResearch,
        [],
      );
      expect(refs.cwes.length).toBeGreaterThan(0);
      expect(refs.owaspEntries.length).toBeGreaterThan(0);
      for (const c of refs.cwes) expect(c.name).not.toBe(c.id);
    },
  );
});
