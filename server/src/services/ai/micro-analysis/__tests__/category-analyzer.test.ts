import { describe, it, expect, vi } from "vitest";
import {
  readCategoryReply,
  analyzeSingleCategory,
  computeCitationCoverage,
} from "../category-analyzer.js";
import type { MicroThreat, CategoryReferenceData } from "../types.js";
import { ProviderRetriesExhaustedError } from "../../provider-errors.js";
import type { ComponentContext } from "../../../threat-generation/context-aware-pipeline.js";

const refs: CategoryReferenceData = {
  threatTemplates: [],
  cwes: [
    { id: "CWE-89", name: "SQL Injection", description: "" } as any,
    { id: "CWE-79", name: "XSS", description: "" } as any,
  ],
  owaspEntries: [{ id: "A03:2021", name: "Injection" } as any],
  complianceReqs: [],
  ruleBasedSeeds: [],
};

const component: ComponentContext = {
  id: "node-db",
  name: "User DB",
  type: "DATABASE",
  dataClassification: "CONFIDENTIAL",
  dataTypes: ["PII"],
  accessPattern: "internal",
  complianceFrameworks: [],
  existingControls: [],
  inbound: [],
  outbound: [],
} as any;

function makeThreat(description: string): MicroThreat {
  return {
    name: "SQL injection",
    description,
    category: "TAMPERING",
    severity: "HIGH",
    componentId: "node-db",
    componentName: "User DB",
    cweIds: [],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "MEDIUM", effectiveness: "0.5" },
    confidence: 0.8,
    sourceMethodology: "stride",
  };
}

describe("computeCitationCoverage", () => {
  it("returns 1.0 for empty threat list (nothing to ground)", () => {
    expect(computeCitationCoverage([], "node-db")).toBe(1.0);
  });

  it("counts a valid REFERENCE tag as grounded", () => {
    const threats = [makeThreat("[ref:CWE-89] User search unparameterised.")];
    expect(computeCitationCoverage(threats, "node-db")).toBe(1.0);
  });

  it("counts a COMPONENT tag as grounded", () => {
    const threats = [makeThreat("[component:node-db] is internet-exposed.")];
    expect(computeCitationCoverage(threats, "node-db")).toBe(1.0);
  });

  it("counts a 'Not found:' prefix as grounded (explicit absence)", () => {
    const threats = [makeThreat("Not found: encryption at rest details.")];
    expect(computeCitationCoverage(threats, "node-db")).toBe(1.0);
  });

  it("does NOT count format-invalid CWE as grounded", () => {
    const threats = [makeThreat("[ref:CWE-NOT_A_NUMBER] bogus.")];
    expect(computeCitationCoverage(threats, "node-db")).toBe(0);
  });

  it("does NOT count plain prose as grounded", () => {
    const threats = [makeThreat("Just a claim with no tag.")];
    expect(computeCitationCoverage(threats, "node-db")).toBe(0);
  });

  it("mixed — returns the grounded fraction", () => {
    const threats = [
      makeThreat("[ref:CWE-89] SQL injection."),
      makeThreat("Plain claim without tag."),
      makeThreat("[component:node-db] exposed."),
      makeThreat("Another plain one."),
    ];
    expect(computeCitationCoverage(threats, "node-db")).toBe(0.5);
  });
});

describe("analyzeSingleCategory — citation loop", () => {
  it("triggers the citation loop when coverage is below threshold", async () => {
    let callIdx = 0;
    const responses = [
      // First pass: 2 threats, no citations — coverage = 0
      JSON.stringify([
        {
          name: "SQL injection",
          description: "User search is unparameterised.",
          severity: "HIGH",
          confidence: 0.9,
        },
        {
          name: "Stored XSS",
          description: "Comment field renders raw.",
          severity: "MEDIUM",
          confidence: 0.9,
        },
      ]),
      // Citation-loop response: same threats with tags
      JSON.stringify([
        {
          name: "SQL injection",
          description: "[ref:CWE-89] User search is unparameterised.",
          severity: "HIGH",
          confidence: 0.9,
        },
        {
          name: "Stored XSS",
          description: "[ref:CWE-79] Comment field renders raw.",
          severity: "MEDIUM",
          confidence: 0.9,
        },
      ]),
    ];
    const aiCall = vi.fn().mockImplementation(() => {
      return Promise.resolve(responses[callIdx++]);
    });

    const { threats: result } = await analyzeSingleCategory(
      aiCall,
      component,
      "TAMPERING",
      "stride",
      refs,
      { minConfidence: 0.7, maxLoops: 3, minCitationCoverage: 0.5 },
    );

    expect(aiCall).toHaveBeenCalledTimes(2); // original + citation follow-up
    expect(result).toHaveLength(2);
    // Tags are stripped from stored descriptions; verify the re-cited text survived
    expect(result[0].description).toContain("User search is unparameterised.");
    expect(result[1].description).toContain("Comment field renders raw.");
  });

  it("skips the citation loop when first-pass coverage is already good", async () => {
    const goodResponse = JSON.stringify([
      {
        name: "SQL injection",
        description: "[ref:CWE-89] User search is unparameterised.",
        severity: "HIGH",
        confidence: 0.9,
      },
    ]);
    const aiCall = vi.fn().mockResolvedValue(goodResponse);

    const { threats: result } = await analyzeSingleCategory(
      aiCall,
      component,
      "TAMPERING",
      "stride",
      refs,
      { minConfidence: 0.7, maxLoops: 3, minCitationCoverage: 0.5 },
    );

    expect(aiCall).toHaveBeenCalledTimes(1); // no follow-up
    expect(result).toHaveLength(1);
  });

  it("falls back to un-cited threats when citation follow-up fails", async () => {
    let callIdx = 0;
    const firstResponse = JSON.stringify([
      {
        name: "SQL injection",
        description: "User search is unparameterised.",
        severity: "HIGH",
        confidence: 0.9,
      },
    ]);
    const aiCall = vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return Promise.resolve(firstResponse);
      return Promise.reject(new Error("ECONNREFUSED"));
    });

    const { threats: result } = await analyzeSingleCategory(
      aiCall,
      component,
      "TAMPERING",
      "stride",
      refs,
      { minConfidence: 0.7, maxLoops: 3, minCitationCoverage: 0.5 },
    );

    expect(aiCall).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    // Original un-cited threat preserved
    expect(result[0].description).toBe("User search is unparameterised.");
  });

  it("R7: re-cite returning 1 of 3 keeps all 3 (merge by identity, never shrink)", async () => {
    let callIdx = 0;
    const firstPass = JSON.stringify([
      {
        name: "SQL injection",
        description: "User search is unparameterised.",
        severity: "HIGH",
        confidence: 0.9,
      },
      {
        name: "Stored XSS",
        description: "Comment field renders raw.",
        severity: "MEDIUM",
        confidence: 0.9,
      },
      {
        name: "Broken auth",
        description: "Session tokens never expire.",
        severity: "HIGH",
        confidence: 0.9,
      },
    ]);
    // Citation follow-up only re-emits one of the three, with a tag.
    const recited = JSON.stringify([
      {
        name: "SQL injection",
        description: "[ref:CWE-89] User search is unparameterised.",
        severity: "HIGH",
        confidence: 0.9,
      },
    ]);
    const aiCall = vi.fn().mockImplementation(() => {
      return Promise.resolve(callIdx++ === 0 ? firstPass : recited);
    });

    const { threats: result } = await analyzeSingleCategory(
      aiCall,
      component,
      "TAMPERING",
      "stride",
      refs,
      { minConfidence: 0.7, maxLoops: 3, minCitationCoverage: 0.5 },
    );

    expect(aiCall).toHaveBeenCalledTimes(2);
    // The bug: `threats = recited` drops the 2 threats re-cite didn't
    // return. Fixed behavior: recited threats replace their matching
    // original (picking up the citation), and originals re-cite dropped
    // are kept — the set never shrinks.
    expect(result).toHaveLength(3);
    const names = result.map((t) => t.name.toLowerCase()).sort();
    expect(names).toEqual(["broken auth", "sql injection", "stored xss"]);
    const sqli = result.find((t) => t.name === "SQL injection");
    expect(sqli?.description).toContain("User search is unparameterised.");
  });

  it("R7: re-cite returning a superset yields the superset", async () => {
    let callIdx = 0;
    const firstPass = JSON.stringify([
      {
        name: "SQL injection",
        description: "User search is unparameterised.",
        severity: "HIGH",
        confidence: 0.9,
      },
    ]);
    const recited = JSON.stringify([
      {
        name: "SQL injection",
        description: "[ref:CWE-89] User search is unparameterised.",
        severity: "HIGH",
        confidence: 0.9,
      },
      {
        name: "Stored XSS",
        description: "[ref:CWE-79] Comment field renders raw.",
        severity: "MEDIUM",
        confidence: 0.9,
      },
    ]);
    const aiCall = vi.fn().mockImplementation(() => {
      return Promise.resolve(callIdx++ === 0 ? firstPass : recited);
    });

    const { threats: result } = await analyzeSingleCategory(
      aiCall,
      component,
      "TAMPERING",
      "stride",
      refs,
      { minConfidence: 0.7, maxLoops: 3, minCitationCoverage: 0.5 },
    );

    expect(aiCall).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
    const names = result.map((t) => t.name.toLowerCase()).sort();
    expect(names).toEqual(["sql injection", "stored xss"]);
  });

  it("threads first-pass gaps into the confidence-loop follow-up prompt", async () => {
    let callIdx = 0;
    const capturedPrompts: string[] = [];
    // First pass: grounded but low confidence + explicit GAPS line so the
    // confidence loop will fire and must receive the gaps verbatim.
    const firstPass = JSON.stringify({
      threats: [
        {
          name: "SQL injection",
          description: "[ref:CWE-89] User search is unparameterised.",
          severity: "HIGH",
          confidence: 0.4,
        },
      ],
      gaps: ["no info on ORM version", "rate limit on /search unknown"],
    });
    const secondPass = JSON.stringify([]);
    const aiCall = vi.fn().mockImplementation((_system, user) => {
      capturedPrompts.push(user);
      return Promise.resolve(callIdx++ === 0 ? firstPass : secondPass);
    });

    await analyzeSingleCategory(
      aiCall,
      component,
      "TAMPERING",
      "stride",
      refs,
      { minConfidence: 0.7, maxLoops: 3, minCitationCoverage: 0 },
    );

    expect(aiCall).toHaveBeenCalledTimes(2);
    const followUp = capturedPrompts[1];
    expect(followUp).toContain("## Gaps You Identified on First Pass");
    expect(followUp).toContain("- no info on ORM version");
    expect(followUp).toContain("- rate limit on /search unknown");
  });

  it("confidence loop runs without a Gaps section when none were emitted", async () => {
    let callIdx = 0;
    const capturedPrompts: string[] = [];
    const firstPass = JSON.stringify([
      {
        name: "SQL injection",
        description: "[ref:CWE-89] User search is unparameterised.",
        severity: "HIGH",
        confidence: 0.4,
      },
    ]);
    const aiCall = vi.fn().mockImplementation((_system, user) => {
      capturedPrompts.push(user);
      return Promise.resolve(callIdx++ === 0 ? firstPass : "[]");
    });

    await analyzeSingleCategory(
      aiCall,
      component,
      "TAMPERING",
      "stride",
      refs,
      { minConfidence: 0.7, maxLoops: 3, minCitationCoverage: 0 },
    );

    expect(aiCall).toHaveBeenCalledTimes(2);
    expect(capturedPrompts[1]).not.toContain("## Gaps You Identified");
  });

  it("minCitationCoverage=0 disables the loop entirely", async () => {
    const response = JSON.stringify([
      {
        name: "Ungrounded threat",
        description: "No citation here.",
        severity: "HIGH",
        confidence: 0.9,
      },
    ]);
    const aiCall = vi.fn().mockResolvedValue(response);

    await analyzeSingleCategory(
      aiCall,
      component,
      "TAMPERING",
      "stride",
      refs,
      { minConfidence: 0.7, maxLoops: 3, minCitationCoverage: 0 },
    );

    expect(aiCall).toHaveBeenCalledTimes(1);
  });
});

describe("analyzeSingleCategory — provider retry / failure recording", () => {
  it("provider fails twice then succeeds — returns the full set (retry helper)", async () => {
    let calls = 0;
    const goodResponse = JSON.stringify([
      {
        name: "SQL injection",
        description: "[ref:CWE-89] User search is unparameterised.",
        severity: "HIGH",
        confidence: 0.9,
      },
    ]);
    const aiCall = vi.fn().mockImplementation(() => {
      calls++;
      if (calls < 3) return Promise.reject(new Error("ECONNREFUSED"));
      return Promise.resolve(goodResponse);
    });

    const { threats, parseFailures } = await analyzeSingleCategory(
      aiCall,
      component,
      "TAMPERING",
      "stride",
      refs,
      {
        minConfidence: 0.7,
        maxLoops: 3,
        minCitationCoverage: 0,
        retrySleep: async () => {},
      },
    );

    expect(aiCall).toHaveBeenCalledTimes(3);
    expect(threats).toHaveLength(1);
    expect(parseFailures).toHaveLength(0);
  });

  it("provider always fails — records a ParseFailure instead of a silent empty result (R8)", async () => {
    const aiCall = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const { threats, parseFailures } = await analyzeSingleCategory(
      aiCall,
      component,
      "TAMPERING",
      "stride",
      refs,
      {
        minConfidence: 0.7,
        maxLoops: 3,
        minCitationCoverage: 0,
        retrySleep: async () => {},
      },
    );

    // Bounded: 3 attempts, not unbounded and not a single silent give-up.
    expect(aiCall).toHaveBeenCalledTimes(3);
    expect(threats).toHaveLength(0);
    // R8 — a failed unit is recorded, not indistinguishable from "no threats".
    expect(parseFailures).toHaveLength(1);
    expect(parseFailures[0].stage).toBe("provider-failure");
    expect(parseFailures[0].error).toContain("ECONNREFUSED");
  });

  it("does not retry a 400 (prompt-too-large) first-pass error", async () => {
    const aiCall = vi
      .fn()
      .mockRejectedValue(new Error("LM Studio error: 400 - context too large"));

    const { threats, parseFailures } = await analyzeSingleCategory(
      aiCall,
      component,
      "TAMPERING",
      "stride",
      refs,
      {
        minConfidence: 0.7,
        maxLoops: 3,
        minCitationCoverage: 0,
        retrySleep: async () => {},
      },
    );

    // 1 first-pass attempt (not retried) + 1 minimal-prompt fallback attempt.
    expect(aiCall).toHaveBeenCalledTimes(2);
    expect(threats).toHaveLength(0);
    expect(parseFailures).toHaveLength(1);
  });
});

describe("readCategoryReply", () => {
  it("reads the {threats,gaps} object", () => {
    const r = readCategoryReply('{"threats":[{"name":"a"}],"gaps":["g1"," "]}');
    expect(JSON.parse(r.threatsRaw)).toEqual([{ name: "a" }]);
    expect(r.gaps).toEqual(["g1"]);
  });
  it("falls back to a bare array plus legacy GAPS line", () => {
    const r = readCategoryReply('[{"name":"a"}]\nGAPS: ["g2"]');
    expect(r.gaps).toEqual(["g2"]);
    expect(r.threatsRaw).toContain('"name":"a"');
  });

  it("a crashed local model is not mistaken for a prompt that is too large", async () => {
    const aiCall = vi
      .fn()
      .mockRejectedValue(
        new ProviderRetriesExhaustedError(
          "LM Studio error: 400 - The model has crashed without additional information. (Exit code: null)",
        ),
      );

    const { parseFailures } = await analyzeSingleCategory(
      aiCall,
      component,
      "TAMPERING",
      "stride",
      refs,
      {
        minConfidence: 0.7,
        maxLoops: 3,
        minCitationCoverage: 0,
        retrySleep: async () => {},
      },
    );

    // The provider already retried; no outer retries and no minimal-prompt call.
    expect(aiCall).toHaveBeenCalledTimes(1);
    expect(parseFailures).toHaveLength(1);
    expect(parseFailures[0].error).toContain("crashed");
  });

  it("does not take a non-context 400 (schema error) for prompt-too-large", async () => {
    const aiCall = vi
      .fn()
      .mockRejectedValue(
        new Error("LM Studio error: 400 - 'messages' is required"),
      );

    await analyzeSingleCategory(
      aiCall,
      component,
      "TAMPERING",
      "stride",
      refs,
      {
        minConfidence: 0.7,
        maxLoops: 3,
        minCitationCoverage: 0,
        retrySleep: async () => {},
      },
    );

    // Not retried (a 400 is not transient) and no minimal-prompt fallback.
    expect(aiCall).toHaveBeenCalledTimes(1);
  });
});
