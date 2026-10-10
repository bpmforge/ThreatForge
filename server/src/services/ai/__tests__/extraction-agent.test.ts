import { describe, it, expect } from "vitest";
import {
  applyValidationDefenses,
  parseValidationGaps,
  purgePhantomMissings,
  validateExtractionQuotes,
  type ExtractionResult,
  type ValidationGaps,
} from "../extraction-agent.js";

function makeGaps(overrides: Partial<ValidationGaps> = {}): ValidationGaps {
  return {
    missingComponents: [],
    missingFlows: [],
    missingBoundaries: [],
    trustLevelCorrections: [],
    missingClassifications: [],
    missingDependencies: [],
    missingMLComponents: [],
    defenses: [],
    completenessScore: 80,
    gaps: [],
    ...overrides,
  };
}

function makeExtraction(
  overrides: Partial<ExtractionResult> = {},
): ExtractionResult {
  return {
    components: [],
    dataFlows: [],
    boundaries: [],
    dependencies: [],
    mlComponents: [],
    technologies: [],
    dataTypes: [],
    confidence: 0,
    warnings: [],
    passesCompleted: 0,
    coverageMetrics: {
      componentCount: 0,
      flowCount: 0,
      boundaryCount: 0,
      componentsWithTrustLevels: 0,
      componentsWithDataClassification: 0,
      flowsWithProtocol: 0,
      flowsWithEncryptionStatus: 0,
      boundariesWithComponents: 0,
      dependenciesExtracted: 0,
      mlComponentsExtracted: 0,
      overallScore: 0,
    },
    ...overrides,
  };
}

const SAMPLE_DOC = [
  "## Architecture Overview",
  "",
  "The Customer Web Frontend talks to the Order API over HTTPS.",
  "Orders are persisted to a Postgres database in the internal VPC.",
  "All payment requests are routed to Stripe via TLS.",
].join("\n");

describe("validateExtractionQuotes", () => {
  it("marks a verbatim sourceText as VERIFIED", () => {
    const e = makeExtraction({
      components: [
        {
          id: "c1",
          name: "Order API",
          type: "api",
          confidence: 0.9,
          sourceText:
            "The Customer Web Frontend talks to the Order API over HTTPS.",
        },
      ],
    });
    validateExtractionQuotes(e, SAMPLE_DOC);
    expect(e.components[0].verificationStatus).toBe("VERIFIED");
  });

  it("marks a paraphrased / fabricated sourceText as UNVERIFIED", () => {
    const e = makeExtraction({
      components: [
        {
          id: "c1",
          name: "Order API",
          type: "api",
          confidence: 0.9,
          sourceText:
            "The Order API uses gRPC and mTLS for all internal calls.",
        },
      ],
    });
    validateExtractionQuotes(e, SAMPLE_DOC);
    expect(e.components[0].verificationStatus).toBe("UNVERIFIED");
  });

  it("respects an explicit INFERRED: prefix even when text is short", () => {
    const e = makeExtraction({
      components: [
        {
          id: "c1",
          name: "Auth Service",
          type: "authService",
          confidence: 0.6,
          sourceText: "INFERRED: RBAC mention implies an auth service.",
        },
      ],
    });
    validateExtractionQuotes(e, SAMPLE_DOC);
    expect(e.components[0].verificationStatus).toBe("INFERRED");
  });

  it("treats too-short quotes (< 12 chars) as INFERRED — not enough signal", () => {
    const e = makeExtraction({
      components: [
        {
          id: "c1",
          name: "DB",
          type: "database",
          confidence: 0.7,
          sourceText: "Postgres",
        },
      ],
    });
    validateExtractionQuotes(e, SAMPLE_DOC);
    expect(e.components[0].verificationStatus).toBe("INFERRED");
  });

  it("leaves verificationStatus undefined when sourceText is missing", () => {
    const e = makeExtraction({
      components: [{ id: "c1", name: "X", type: "service", confidence: 0.5 }],
    });
    validateExtractionQuotes(e, SAMPLE_DOC);
    expect(e.components[0].verificationStatus).toBeUndefined();
  });

  it("validates dataFlows the same way", () => {
    const e = makeExtraction({
      dataFlows: [
        {
          id: "f1",
          sourceId: "c1",
          targetId: "c2",
          confidence: 0.9,
          sourceText: "All payment requests are routed to Stripe via TLS.",
        },
        {
          id: "f2",
          sourceId: "c1",
          targetId: "c3",
          confidence: 0.5,
          sourceText: "Payments are sent to PayPal over plaintext HTTP.",
        },
      ],
    });
    validateExtractionQuotes(e, SAMPLE_DOC);
    expect(e.dataFlows[0].verificationStatus).toBe("VERIFIED");
    expect(e.dataFlows[1].verificationStatus).toBe("UNVERIFIED");
  });

  it("validates boundaries the same way", () => {
    const e = makeExtraction({
      boundaries: [
        {
          id: "b1",
          name: "Internal VPC",
          componentIds: ["c1"],
          confidence: 0.9,
          sourceText: "persisted to a Postgres database in the internal VPC",
        },
      ],
    });
    validateExtractionQuotes(e, SAMPLE_DOC);
    expect(e.boundaries[0].verificationStatus).toBe("VERIFIED");
  });

  it("matches across whitespace differences (PDF-style multi-space, newlines)", () => {
    const e = makeExtraction({
      components: [
        {
          id: "c1",
          name: "Order API",
          type: "api",
          confidence: 0.9,
          sourceText:
            "The Customer Web Frontend talks to the Order API over HTTPS.",
        },
      ],
    });
    const messyDoc =
      "The Customer    Web Frontend\ntalks  to the\nOrder API   over HTTPS.";
    validateExtractionQuotes(e, messyDoc);
    expect(e.components[0].verificationStatus).toBe("VERIFIED");
  });

  it("is case-insensitive", () => {
    const e = makeExtraction({
      components: [
        {
          id: "c1",
          name: "DB",
          type: "database",
          confidence: 0.9,
          sourceText: "PERSISTED TO A POSTGRES DATABASE IN THE INTERNAL VPC",
        },
      ],
    });
    validateExtractionQuotes(e, SAMPLE_DOC);
    expect(e.components[0].verificationStatus).toBe("VERIFIED");
  });
});

describe("purgePhantomMissings", () => {
  it("keeps entries whose sourceText matches the document", () => {
    const gaps = makeGaps({
      missingComponents: [
        {
          name: "Stripe",
          type: "externalService",
          sourceText: "All payment requests are routed to Stripe via TLS.",
        },
      ],
    });
    const result = purgePhantomMissings(gaps, SAMPLE_DOC, {
      requireSourceText: true,
    });
    expect(result.removed).toBe(0);
    expect(gaps.missingComponents).toHaveLength(1);
  });

  it("drops entries whose sourceText is not in the document (phantoms)", () => {
    const gaps = makeGaps({
      missingComponents: [
        {
          name: "PayPal",
          type: "externalService",
          sourceText: "PayPal is the backup payment processor for the site.",
        },
      ],
    });
    const result = purgePhantomMissings(gaps, SAMPLE_DOC, {
      requireSourceText: true,
    });
    expect(result.removed).toBe(1);
    expect(gaps.missingComponents).toHaveLength(0);
    expect(result.reasons[0]).toMatch(/not in doc.*PayPal/);
  });

  it("drops entries lacking a sourceText when requireSourceText=true", () => {
    const gaps = makeGaps({
      missingComponents: [{ name: "SomeService", type: "service" }],
    });
    const result = purgePhantomMissings(gaps, SAMPLE_DOC, {
      requireSourceText: true,
    });
    expect(result.removed).toBe(1);
    expect(gaps.missingComponents).toHaveLength(0);
  });

  it("keeps entries lacking a sourceText when requireSourceText=false (default)", () => {
    const gaps = makeGaps({
      missingComponents: [{ name: "SomeService", type: "service" }],
    });
    purgePhantomMissings(gaps, SAMPLE_DOC);
    expect(gaps.missingComponents).toHaveLength(1);
  });

  it("applies to all missing-X collections, not just components", () => {
    const gaps = makeGaps({
      missingFlows: [
        {
          sourceId: "a",
          targetId: "b",
          sourceText: "Flow text not in document.",
        },
      ],
      missingBoundaries: [
        {
          name: "DMZ",
          componentIds: [],
          sourceText: "public internet gateway sits in the DMZ zone",
        },
      ],
      missingDependencies: [
        {
          name: "left-pad",
          type: "direct",
          sourceText: "left-pad is in npm",
        },
      ],
      missingMLComponents: [
        {
          name: "FraudModel",
          sourceText: "Fraud detection neural network",
        },
      ],
    });
    const result = purgePhantomMissings(gaps, SAMPLE_DOC, {
      requireSourceText: true,
    });
    // None survive — all sourceText fragments are not in SAMPLE_DOC
    expect(gaps.missingFlows).toHaveLength(0);
    expect(gaps.missingBoundaries).toHaveLength(0);
    expect(gaps.missingDependencies).toHaveLength(0);
    expect(gaps.missingMLComponents).toHaveLength(0);
    expect(result.removed).toBe(4);
  });
});

describe("applyValidationDefenses", () => {
  it("drops a missingComponent marked RETRACT", () => {
    const gaps = makeGaps({
      missingComponents: [
        { name: "Ghost", type: "service", sourceText: "Ghost is mentioned" },
        { name: "Real", type: "api", sourceText: "Real API" },
      ],
      defenses: [
        { name: "Ghost", action: "RETRACT", rationale: "on reread, not there" },
      ],
    });
    const result = applyValidationDefenses(gaps, SAMPLE_DOC);
    expect(result.dropped).toBe(1);
    expect(result.retractedNames).toEqual(["Ghost"]);
    expect(gaps.missingComponents.map((c) => c.name)).toEqual(["Real"]);
  });

  it("keeps a DEFEND with a verbatim-in-doc citation", () => {
    const gaps = makeGaps({
      missingComponents: [
        { name: "Stripe", type: "externalService", sourceText: "stripe quote" },
      ],
      defenses: [
        {
          name: "Stripe",
          action: "DEFEND",
          citation: "All payment requests are routed to Stripe via TLS.",
        },
      ],
    });
    const result = applyValidationDefenses(gaps, SAMPLE_DOC);
    expect(result.dropped).toBe(0);
    expect(gaps.missingComponents).toHaveLength(1);
  });

  it("promotes DEFEND-without-valid-citation silently to RETRACT", () => {
    const gaps = makeGaps({
      missingComponents: [
        { name: "Stripe", type: "externalService", sourceText: "q" },
      ],
      defenses: [
        {
          name: "Stripe",
          action: "DEFEND",
          citation: "trust me, it's there",
        },
      ],
    });
    const result = applyValidationDefenses(gaps, SAMPLE_DOC);
    expect(result.dropped).toBe(1);
    expect(gaps.missingComponents).toHaveLength(0);
  });

  it("matches defense-name to missingComponent-name case-insensitively", () => {
    const gaps = makeGaps({
      missingComponents: [
        { name: "Stripe   API", type: "externalService", sourceText: "q" },
      ],
      defenses: [{ name: "stripe api", action: "RETRACT" }],
    });
    applyValidationDefenses(gaps, SAMPLE_DOC);
    expect(gaps.missingComponents).toHaveLength(0);
  });

  it("leaves QUALIFY entries in place (Pass 3 can read the qualification)", () => {
    const gaps = makeGaps({
      missingComponents: [
        { name: "X", type: "service", sourceText: "in the internal VPC" },
      ],
      defenses: [
        {
          name: "X",
          action: "QUALIFY",
          qualification: "X is probably just a shell, not a full service",
        },
      ],
    });
    const result = applyValidationDefenses(gaps, SAMPLE_DOC);
    expect(result.dropped).toBe(0);
    expect(gaps.missingComponents).toHaveLength(1);
  });

  it("ignores defenses whose name doesn't match any missing entry", () => {
    const gaps = makeGaps({
      missingComponents: [{ name: "A", type: "service", sourceText: "q" }],
      defenses: [{ name: "ghost", action: "RETRACT" }],
    });
    const result = applyValidationDefenses(gaps, SAMPLE_DOC);
    expect(result.dropped).toBe(0);
    expect(gaps.missingComponents).toHaveLength(1);
  });
});

describe("parseValidationGaps — defenses + gaps", () => {
  it("parses defenses[] into a normalized array", () => {
    const raw = JSON.stringify({
      missingComponents: [],
      defenses: [
        { name: "A", action: "DEFEND", citation: "[ref:X]" },
        { name: "B", action: "retract", rationale: "speculation" },
        { name: "C", action: "ignore" }, // invalid action → dropped
        { action: "DEFEND" }, // no name → dropped
      ],
      gaps: ["concrete gap 1", 42, "concrete gap 2"],
    });
    const v = parseValidationGaps(raw);
    expect(v.defenses).toHaveLength(2);
    expect(v.defenses[0].action).toBe("DEFEND");
    expect(v.defenses[1].action).toBe("RETRACT");
    expect(v.gaps).toEqual(["concrete gap 1", "concrete gap 2"]);
  });

  it("returns empty defaults on malformed JSON", () => {
    const v = parseValidationGaps("not JSON at all");
    expect(v.defenses).toEqual([]);
    expect(v.missingComponents).toEqual([]);
    expect(v.gaps).toEqual([]);
  });
});
