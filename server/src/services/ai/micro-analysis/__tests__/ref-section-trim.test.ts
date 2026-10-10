/**
 * The reference-block size guard must drop by priority, not by position.
 *
 * The system prompt mandates citing CWE and OWASP ids by exact id and forbids
 * inventing them. A guard that drops those first while keeping the sections
 * nobody is asked to cite is asking for a hallucinated citation, so these
 * tests pin the ordering rather than the byte budget.
 */
import { describe, it, expect } from "vitest";
import { buildCategoryPrompt } from "../micro-prompt-builder.js";
import type { ComponentContext } from "../../../threat-generation/context-aware-pipeline.js";
import type { CategoryReferenceData } from "../types.js";

const component: ComponentContext = {
  id: "comp-x",
  name: "Payments API",
  type: "API",
  description: "x".repeat(400),
  dataClassification: "RESTRICTED",
  dataTypes: ["payment tokens"],
  accessPattern: "INTERNAL_ONLY",
  complianceFrameworks: ["PCI-DSS"],
  existingControls: [],
  trustZone: "INTERNAL",
  inbound: [],
  outbound: [],
};

/** Reference data large enough to force the guard. */
function bulkyRefs(): CategoryReferenceData {
  return {
    // Must exceed REF_BUDGET_CHARS (12000) once joined, or the guard never
    // fires and this asserts nothing.
    threatTemplates: Array.from({ length: 4 }, (_, i) => ({
      name: `Template ${i} ${"t".repeat(2000)}`,
      description: "d".repeat(2000),
      cweIds: ["CWE-999"],
    })) as CategoryReferenceData["threatTemplates"],
    ruleBasedSeeds: Array.from({ length: 3 }, (_, i) => ({
      name: `Seed ${i} ${"s".repeat(2000)}`,
      severity: "HIGH",
    })) as CategoryReferenceData["ruleBasedSeeds"],
    cwes: [
      { id: "CWE-89", name: "SQL Injection" },
    ] as CategoryReferenceData["cwes"],
    owaspEntries: [
      { id: "A03:2021", name: "Injection", relevance: "applies" },
    ] as CategoryReferenceData["owaspEntries"],
    complianceReqs: [
      { framework: "PCI-DSS", clause: "Req 6.5", requirement: "Secure coding" },
    ] as CategoryReferenceData["complianceReqs"],
  };
}

describe("reference-section trimming", () => {
  it("keeps mandated CWE and OWASP citations when over budget", () => {
    const { user } = buildCategoryPrompt(component, "TAMPERING", bulkyRefs());
    expect(user).toContain("CWE-89");
    expect(user).toContain("A03:2021");
  });

  it("drops the sections nobody is asked to cite first", () => {
    const { user } = buildCategoryPrompt(component, "TAMPERING", bulkyRefs());
    // Templates and rule-based seeds are the lowest priority; at this size at
    // least one of them must have gone to make room.
    const keptTemplates = user.includes(
      "Known Threats for This Component Type",
    );
    const keptSeeds = user.includes("Rule-Based Findings");
    expect(keptTemplates && keptSeeds).toBe(false);
  });

  it("keeps compliance clauses ahead of templates", () => {
    const { user } = buildCategoryPrompt(component, "TAMPERING", bulkyRefs());
    expect(user).toContain("Req 6.5");
  });

  it("keeps everything when the prompt is small", () => {
    const small: CategoryReferenceData = {
      threatTemplates: [],
      ruleBasedSeeds: [],
      cwes: [
        { id: "CWE-89", name: "SQL Injection" },
      ] as CategoryReferenceData["cwes"],
      owaspEntries: [],
      complianceReqs: [],
    };
    const { user } = buildCategoryPrompt(component, "TAMPERING", small);
    expect(user).toContain("CWE-89");
  });
});
