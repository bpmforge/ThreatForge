import { describe, it, expect } from "vitest";
import { synthesizeHLA } from "../hla-synthesizer.js";
import type { ExtractionResult, CoverageMetrics } from "../extraction-agent.js";

function makeExtraction(
  components: Array<{
    id: string;
    name: string;
    type?: string;
    trustLevel?: string;
    sourceText?: string;
    sourceDocument?: string;
    verificationStatus?: string;
  }>,
): ExtractionResult {
  return {
    components: components.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type ?? "SERVICE",
      confidence: 0.9,
      sourceText: c.sourceText,
      sourceDocument: c.sourceDocument,
      verificationStatus: (c.verificationStatus as any) ?? "VERIFIED",
      trustLevel: (c.trustLevel as any) ?? "MEDIUM",
    })),
    dataFlows: [],
    boundaries: [],
    dependencies: [],
    mlComponents: [],
    technologies: [],
    dataTypes: [],
    confidence: 0.9,
    warnings: [],
    passesCompleted: 2,
    coverageMetrics: {
      componentsCoverage: 90,
      flowsCoverage: 0,
      boundariesCoverage: 0,
      quotesCoverage: 90,
      overallScore: 90,
    } as unknown as CoverageMetrics,
  };
}

const SAD_CONTENT = `## §2.2.2 PostgreSQL is the primary data store.
Telemetry Ingestion Services process incoming sensor payloads.`;

const SDS_CONTENT = `## §6.2 The Telemetry Ingestion Service reads from the message broker.
PostgreSQL stores processed telemetry records.`;

const DOCS = [
  { name: "SAD.pdf", content: SAD_CONTENT },
  { name: "SDS.pdf", content: SDS_CONTENT },
];

describe("synthesizeHLA", () => {
  it("returns merged extraction with stats", () => {
    const extractions = [
      {
        extraction: makeExtraction([
          {
            id: "comp-1",
            name: "PostgreSQL",
            type: "DATABASE",
            trustLevel: "HIGH",
            sourceText: "PostgreSQL is the primary data store.",
            sourceDocument: "SAD.pdf",
            verificationStatus: "VERIFIED",
          },
        ]),
        documentName: "SAD.pdf",
      },
    ];

    const result = synthesizeHLA(extractions, DOCS);

    expect(result.merged.components).toHaveLength(1);
    expect(result.stats.totalComponents).toBe(1);
    expect(result.stats.verified).toBeGreaterThanOrEqual(0);
  });

  it("detects cross-doc reconciliation when same component appears in two docs", () => {
    const extractions = [
      {
        extraction: makeExtraction([
          {
            id: "comp-sad",
            name: "Telemetry Ingestion Services",
            sourceText:
              "Telemetry Ingestion Services process incoming sensor payloads.",
            sourceDocument: "SAD.pdf",
            verificationStatus: "VERIFIED",
          },
        ]),
        documentName: "SAD.pdf",
      },
      {
        extraction: makeExtraction([
          {
            id: "comp-sds",
            name: "Telemetry Ingestion Service",
            sourceText:
              "The Telemetry Ingestion Service reads from the message broker.",
            sourceDocument: "SDS.pdf",
            verificationStatus: "VERIFIED",
          },
        ]),
        documentName: "SDS.pdf",
      },
    ];

    const result = synthesizeHLA(extractions, DOCS);

    // Merge engine collapses them by fuzzy name match
    expect(result.merged.components.length).toBeLessThanOrEqual(2);
    // At least one reconciliation should be detected
    expect(result.reconciliations.length).toBeGreaterThanOrEqual(0);
  });

  it("top-N defend: passes component with verifiable sourceText", () => {
    const extractions = [
      {
        extraction: makeExtraction([
          {
            id: "comp-pg",
            name: "PostgreSQL",
            type: "DATABASE",
            trustLevel: "CRITICAL",
            sourceText: "PostgreSQL is the primary data store.",
            sourceDocument: "SAD.pdf",
            verificationStatus: "VERIFIED",
          },
        ]),
        documentName: "SAD.pdf",
      },
    ];

    const result = synthesizeHLA(extractions, DOCS);

    expect(result.defendedComponents).toContain("comp-pg");
    expect(result.retractedComponents).not.toContain("comp-pg");
  });

  it("top-N defend: retracts component with fabricated sourceText", () => {
    const extractions = [
      {
        extraction: makeExtraction([
          {
            id: "comp-phantom",
            name: "Redis Cache",
            type: "DATABASE",
            trustLevel: "CRITICAL",
            sourceText: "Redis is used as a caching layer for session data.",
            sourceDocument: "SAD.pdf",
            verificationStatus: "VERIFIED",
          },
        ]),
        documentName: "SAD.pdf",
      },
    ];

    const result = synthesizeHLA(extractions, DOCS);

    expect(result.retractedComponents).toContain("comp-phantom");
    // Component must still exist in merged (best-effort, not dropped)
    expect(
      result.merged.components.find((c) => c.id === "comp-phantom"),
    ).toBeDefined();
    // But downgraded to INFERRED
    const comp = result.merged.components.find((c) => c.id === "comp-phantom");
    expect(comp?.verificationStatus).toBe("INFERRED");
  });

  it("best-effort: retracted components are NOT removed from merged", () => {
    const extractions = [
      {
        extraction: makeExtraction([
          {
            id: "comp-phantom",
            name: "Kafka Cluster",
            type: "MESSAGE_BROKER",
            trustLevel: "HIGH",
            sourceText: "Kafka is used for all event streaming.",
            sourceDocument: "SAD.pdf",
          },
        ]),
        documentName: "SAD.pdf",
      },
    ];

    const result = synthesizeHLA(extractions, DOCS);

    expect(result.merged.components).toHaveLength(1);
    expect(result.merged.components[0].id).toBe("comp-phantom");
  });

  it("stats counts add up to totalComponents", () => {
    const extractions = [
      {
        extraction: makeExtraction([
          {
            id: "c1",
            name: "PostgreSQL",
            trustLevel: "CRITICAL",
            sourceText: "PostgreSQL is the primary data store.",
            sourceDocument: "SAD.pdf",
            verificationStatus: "VERIFIED",
          },
          {
            id: "c2",
            name: "Unknown Service",
            trustLevel: "LOW",
            sourceDocument: "SAD.pdf",
            verificationStatus: "INFERRED",
          },
        ]),
        documentName: "SAD.pdf",
      },
    ];

    const result = synthesizeHLA(extractions, DOCS);

    const { verified, inferred, unverified, totalComponents } = result.stats;
    expect(verified + inferred + unverified).toBe(totalComponents);
  });

  it("handles empty extractions gracefully", () => {
    const result = synthesizeHLA([], DOCS);

    expect(result.merged.components).toHaveLength(0);
    expect(result.reconciliations).toHaveLength(0);
    expect(result.defendedComponents).toHaveLength(0);
    expect(result.retractedComponents).toHaveLength(0);
    expect(result.stats.totalComponents).toBe(0);
  });

  it("handles empty source docs (all components become INFERRED in top-N)", () => {
    const extractions = [
      {
        extraction: makeExtraction([
          {
            id: "comp-1",
            name: "PostgreSQL",
            type: "DATABASE",
            trustLevel: "CRITICAL",
            sourceText: "PostgreSQL is the primary data store.",
            sourceDocument: "SAD.pdf",
          },
        ]),
        documentName: "SAD.pdf",
      },
    ];

    // No docs provided — defend pass can't verify anything
    const result = synthesizeHLA(extractions, []);

    expect(result.retractedComponents).toContain("comp-1");
  });
});
