import { describe, it, expect } from "vitest";
import {
  applyDefenses,
  applyExpertVerification,
  hasValidCitation,
  parseVerification,
  type VerificationDefense,
} from "../expert-analysis.js";

function makeThreat(overrides: Record<string, unknown> = {}) {
  return {
    title: "Spoofing via stolen session token",
    description: "An attacker steals a session cookie and impersonates a user.",
    category: "SPOOFING",
    severity: "HIGH",
    targetComponentId: "node-api",
    targetComponentName: "API",
    attackVector: "1. Steal cookie. 2. Replay.",
    prerequisites: "weak cookie handling",
    mitigation: "rotate tokens",
    mitigationEffectiveness: 0.55,
    residualRisk: "some replay risk",
    confidence: 0.7,
    references: ["CWE-384"],
    analysisType: "component_risk",
    verifiedInPass5: false,
    ...overrides,
  } as any;
}

describe("parseVerification — defenses field", () => {
  it("returns empty defenses when field is absent", () => {
    const raw = JSON.stringify({
      overallQuality: "B",
      rejected: [],
      missing: [],
      severityAdjustments: [],
    });
    expect(parseVerification(raw).defenses).toEqual([]);
  });

  it("parses a well-formed mix of DEFEND / QUALIFY / RETRACT", () => {
    const raw = JSON.stringify({
      overallQuality: "A",
      defenses: [
        {
          title: "SQL injection on search",
          action: "DEFEND",
          citation: "[ref:CWE-89]",
          rationale: "search endpoint is unparameterised",
        },
        {
          title: "Admin panel RCE",
          action: "QUALIFY",
          qualification: "Unauth admin panel allows config read only",
          rationale: "RCE was overclaimed",
        },
        {
          title: "DoS via regex",
          action: "RETRACT",
          rationale: "speculation — no regex input path in architecture",
        },
      ],
    });
    const v = parseVerification(raw);
    expect(v.defenses).toHaveLength(3);
    expect(v.defenses[0].action).toBe("DEFEND");
    expect(v.defenses[1].action).toBe("QUALIFY");
    expect(v.defenses[2].action).toBe("RETRACT");
  });

  it("drops entries with an unknown action", () => {
    const raw = JSON.stringify({
      defenses: [
        { title: "A", action: "IGNORE" },
        { title: "B", action: "defend", citation: "[ref:CWE-89]" },
      ],
    });
    const v = parseVerification(raw);
    expect(v.defenses).toHaveLength(1);
    expect(v.defenses[0].title).toBe("B");
    expect(v.defenses[0].action).toBe("DEFEND");
  });

  it("drops entries with no title", () => {
    const raw = JSON.stringify({
      defenses: [{ action: "DEFEND", citation: "[ref:CWE-89]" }],
    });
    expect(parseVerification(raw).defenses).toEqual([]);
  });

  it("falls back cleanly on malformed JSON", () => {
    const v = parseVerification("not JSON at all");
    expect(v).toEqual({
      quality: "B",
      rejected: [],
      missing: [],
      severityAdjustments: [],
      defenses: [],
      failed: true,
    });
  });

  // A parse failure must be distinguishable
  // from a genuinely clean pass; before the fix both returned the exact same
  // {quality:"B", missing:[]} shape.
  it("marks a parse failure as failed, unlike a clean pass", () => {
    const cleanPass = parseVerification(
      JSON.stringify({ overallQuality: "B", missing: [] }),
    );
    const brokenReply = parseVerification("not JSON at all");

    expect(cleanPass.failed).toBe(false);
    expect(brokenReply.failed).toBe(true);
  });
});

describe("hasValidCitation", () => {
  it.each([
    ["[ref:CWE-89]", true],
    ["[ref:A03:2021]", true],
    ["[component:node-api]", true],
    ["Per [doc:srs.pdf §3.2]", true],
    ["Per [req:FR-12]", true],
  ])("accepts %s", (citation, expected) => {
    expect(hasValidCitation(citation)).toBe(expected);
  });

  it("rejects prose-only defenses without a tag", () => {
    expect(hasValidCitation("trust me, I'm an expert")).toBe(false);
  });

  it("rejects empty / undefined citations", () => {
    expect(hasValidCitation("")).toBe(false);
    expect(hasValidCitation(undefined)).toBe(false);
  });

  it("rejects fabricated bracket-ish text that isn't a valid tag", () => {
    expect(hasValidCitation("[cited: somewhere]")).toBe(false);
    expect(hasValidCitation("see source [CWE-89]")).toBe(false);
  });
});

describe("applyDefenses", () => {
  it("returns threats unchanged when no defenses", () => {
    const threats = [makeThreat()];
    expect(applyDefenses(threats, [])).toEqual(threats);
  });

  it("RETRACT removes the threat", () => {
    const threats = [makeThreat({ title: "A" }), makeThreat({ title: "B" })];
    const defenses: VerificationDefense[] = [
      { title: "A", action: "RETRACT", rationale: "speculation" },
    ];
    const result = applyDefenses(threats, defenses);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("B");
  });

  it("DEFEND without a valid citation is silently promoted to RETRACT", () => {
    const threats = [makeThreat({ title: "A" })];
    const defenses: VerificationDefense[] = [
      {
        title: "A",
        action: "DEFEND",
        citation: "I really think so",
        rationale: "my best guess",
      },
    ];
    expect(applyDefenses(threats, defenses)).toEqual([]);
  });

  it("DEFEND with a valid citation prepends the citation to the description when not already present", () => {
    const threats = [
      makeThreat({ title: "A", description: "plain prose claim" }),
    ];
    const defenses: VerificationDefense[] = [
      {
        title: "A",
        action: "DEFEND",
        citation: "[ref:CWE-89]",
        rationale: "",
      },
    ];
    const result = applyDefenses(threats, defenses);
    expect(result[0].description).toBe("[ref:CWE-89] plain prose claim");
  });

  it("DEFEND does not double-prepend when citation is already in the description", () => {
    const threats = [
      makeThreat({
        title: "A",
        description: "[ref:CWE-89] user search unparameterised",
      }),
    ];
    const defenses: VerificationDefense[] = [
      { title: "A", action: "DEFEND", citation: "[ref:CWE-89]" },
    ];
    const result = applyDefenses(threats, defenses);
    expect(result[0].description).toBe(
      "[ref:CWE-89] user search unparameterised",
    );
  });

  it("QUALIFY replaces the description with the narrower restated claim", () => {
    const threats = [
      makeThreat({
        title: "Admin RCE",
        description: "Unauthenticated attackers run arbitrary code.",
      }),
    ];
    const defenses: VerificationDefense[] = [
      {
        title: "Admin RCE",
        action: "QUALIFY",
        qualification: "Unauthenticated users can read admin config only.",
      },
    ];
    expect(applyDefenses(threats, defenses)[0].description).toBe(
      "Unauthenticated users can read admin config only.",
    );
  });

  it("QUALIFY without a qualification leaves description unchanged", () => {
    const threats = [makeThreat({ title: "A", description: "original" })];
    const defenses: VerificationDefense[] = [{ title: "A", action: "QUALIFY" }];
    expect(applyDefenses(threats, defenses)[0].description).toBe("original");
  });

  it("matches titles case-insensitively with whitespace tolerance", () => {
    const threats = [makeThreat({ title: "SQL   Injection on Search" })];
    const defenses: VerificationDefense[] = [
      { title: "sql injection on search", action: "RETRACT" },
    ];
    expect(applyDefenses(threats, defenses)).toEqual([]);
  });

  it("does not mutate the input threats array", () => {
    const threats = [makeThreat({ title: "A", description: "orig" })];
    applyDefenses(threats, [
      {
        title: "A",
        action: "DEFEND",
        citation: "[ref:CWE-89]",
      },
    ]);
    expect(threats[0].description).toBe("orig");
  });

  it("leaves threats untouched when a defense references an unknown title", () => {
    const threats = [makeThreat({ title: "A" })];
    const defenses: VerificationDefense[] = [
      { title: "ghost", action: "RETRACT" },
    ];
    expect(applyDefenses(threats, defenses)).toEqual(threats);
  });
});

// applyExpertVerification()
// used to stamp verifiedInPass5 = true unconditionally and treat a failed
// parse as "done", so a Pass 5 reply that failed to parse rendered a green
// "Verified in Pass 5" badge exactly like a genuinely clean pass.
describe("applyExpertVerification — failed parse must not read as verified", () => {
  it("does NOT stamp verifiedInPass5 when the pass5 reply fails to parse", () => {
    const threats = [makeThreat({ title: "A", verifiedInPass5: false })];

    const result = applyExpertVerification(threats, "not JSON at all");

    expect(result.threats.every((t) => t.verifiedInPass5 === true)).toBe(false);
  });

  it("exposes a failed verification state on the returned threats", () => {
    const threats = [makeThreat({ title: "A" })];

    const result = applyExpertVerification(threats, "not JSON at all");

    expect(
      result.threats.every(
        (t) => (t as { verificationFailed?: boolean }).verificationFailed,
      ),
    ).toBe(true);
  });

  it("does not report done=true on a failed parse (the loop must not exit early)", () => {
    const threats = [makeThreat({ title: "A" })];

    const result = applyExpertVerification(threats, "not JSON at all");

    expect(result.done).toBe(false);
  });

  it("still stamps verifiedInPass5 and reports done on a genuinely clean pass", () => {
    const threats = [makeThreat({ title: "A" })];
    const cleanRaw = JSON.stringify({ overallQuality: "A", missing: [] });

    const result = applyExpertVerification(threats, cleanRaw);

    expect(result.threats.every((t) => t.verifiedInPass5 === true)).toBe(true);
    expect(result.done).toBe(true);
  });
});
