import { describe, it, expect } from "vitest";
import {
  buildCategoryPrompt,
  buildConfidenceLoopPrompt,
  extractGaps,
} from "../micro-prompt-builder.js";
import type { CategoryReferenceData, MicroThreat } from "../types.js";
import type { ComponentContext } from "../../../threat-generation/context-aware-pipeline.js";

const emptyRefs: CategoryReferenceData = {
  threatTemplates: [],
  cwes: [],
  owaspEntries: [],
  complianceReqs: [],
  ruleBasedSeeds: [],
};

const component: ComponentContext = {
  id: "node-api",
  name: "Public API",
  type: "SERVICE",
  dataClassification: "CONFIDENTIAL",
  dataTypes: ["PII"],
  accessPattern: "internet-facing",
  complianceFrameworks: [],
  existingControls: [],
  inbound: [],
  outbound: [],
} as any;

describe("buildCategoryPrompt — gap instruction", () => {
  it("asks for gaps inside the JSON object, with no contradictory fence/array rules", () => {
    const { system } = buildCategoryPrompt(component, "SPOOFING", emptyRefs);
    expect(system).toContain('"gaps"');
    expect(system).toContain('{"threats":[');
    expect(system).not.toContain("GAPS:");
    expect(system).not.toMatch(/ONLY a JSON array/);
    expect(system).not.toContain("```");
  });

  it("does not cap the threat count at 3 and adds the class-grain rule", () => {
    const { system } = buildCategoryPrompt(component, "SPOOFING", emptyRefs);
    expect(system).not.toMatch(/0-3/);
    expect(system).toMatch(/one threat per distinct control gap/);
  });

  it("forbids vague gap language", () => {
    const { system } = buildCategoryPrompt(component, "SPOOFING", emptyRefs);
    expect(system).toMatch(/Do NOT write vague gaps like "more context"/);
  });

  it("gives concrete gap examples referring to real architectural inputs", () => {
    const { system } = buildCategoryPrompt(component, "SPOOFING", emptyRefs);
    expect(system).toMatch(/encryption-at-rest/);
    expect(system).toMatch(/rate limit/);
  });
});

describe("extractGaps", () => {
  it("parses a well-formed GAPS line after a JSON array", () => {
    const raw = `[{"name":"t1"}]\nGAPS: ["missing encryption-at-rest", "no rate limit documented"]`;
    expect(extractGaps(raw)).toEqual([
      "missing encryption-at-rest",
      "no rate limit documented",
    ]);
  });

  it("returns empty array on GAPS: []", () => {
    const raw = `[]\nGAPS: []`;
    expect(extractGaps(raw)).toEqual([]);
  });

  it("returns empty array when no GAPS line is present", () => {
    const raw = `[{"name":"t1"}]`;
    expect(extractGaps(raw)).toEqual([]);
  });

  it("tolerates extra whitespace and case variants", () => {
    const raw = `[]\n\n  gaps  :  ["one"]  `;
    expect(extractGaps(raw)).toEqual(["one"]);
  });

  it("drops non-string entries silently", () => {
    const raw = `[]\nGAPS: ["real gap", 42, null, "another gap"]`;
    expect(extractGaps(raw)).toEqual(["real gap", "another gap"]);
  });

  it("returns empty array on malformed GAPS JSON", () => {
    const raw = `[]\nGAPS: [not valid json`;
    expect(extractGaps(raw)).toEqual([]);
  });

  it("trims whitespace around each gap", () => {
    const raw = `[]\nGAPS: ["  spaced  "]`;
    expect(extractGaps(raw)).toEqual(["spaced"]);
  });

  it("handles multi-line GAPS content", () => {
    const raw = `[]\nGAPS: [\n  "gap 1",\n  "gap 2"\n]`;
    expect(extractGaps(raw)).toEqual(["gap 1", "gap 2"]);
  });
});

describe("buildConfidenceLoopPrompt — gaps threading", () => {
  const existing: MicroThreat[] = [
    {
      name: "Session fixation",
      description: "",
      category: "SPOOFING",
      severity: "HIGH",
      componentId: "node-api",
      componentName: "Public API",
      cweIds: [],
      owaspIds: [],
      evidence: {},
      mitigations: [],
      mitigation: { description: "", effort: "MEDIUM", effectiveness: "0.5" },
      confidence: 0.6,
      sourceMethodology: "stride",
    },
  ];

  it("injects a dedicated Gaps section when gaps are supplied", () => {
    const { user } = buildConfidenceLoopPrompt(
      component,
      "SPOOFING",
      existing,
      emptyRefs,
      ["no docs on token rotation", "unclear whether /admin is gated by MFA"],
    );
    expect(user).toContain("## Gaps You Identified on First Pass");
    expect(user).toContain("- no docs on token rotation");
    expect(user).toContain("- unclear whether /admin is gated by MFA");
  });

  it("omits the Gaps section when gap list is empty", () => {
    const { user } = buildConfidenceLoopPrompt(
      component,
      "SPOOFING",
      existing,
      emptyRefs,
      [],
    );
    expect(user).not.toContain("## Gaps You Identified on First Pass");
  });

  it("remains backward-compatible when gaps arg is omitted", () => {
    const { user } = buildConfidenceLoopPrompt(
      component,
      "SPOOFING",
      existing,
      emptyRefs,
    );
    expect(user).not.toContain("## Gaps You Identified");
    expect(user).toContain("Already Found");
  });

  it("caps gap list at 8 entries to keep prompt size bounded", () => {
    const many = Array.from({ length: 15 }, (_, i) => `gap-${i}`);
    const { user } = buildConfidenceLoopPrompt(
      component,
      "SPOOFING",
      existing,
      emptyRefs,
      many,
    );
    expect(user).toContain("gap-0");
    expect(user).toContain("gap-7");
    expect(user).not.toContain("gap-8");
  });

  it("tells the model to skip gaps it cannot legitimately address", () => {
    const { user } = buildConfidenceLoopPrompt(
      component,
      "SPOOFING",
      existing,
      emptyRefs,
      ["some gap"],
    );
    expect(user).toMatch(/do not manufacture a threat to fill the slot/);
  });
});
