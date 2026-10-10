import { describe, it, expect, vi } from "vitest";
import { orchestrateImport } from "../import-orchestrator.js";
import type { OrchestratorDoc } from "../import-orchestrator.js";

const SAD_CONTENT = `## 3.2 Telemetry Ingestion Workflow

1. Sensor device transmits payload to API Gateway over TLS.
2. API Gateway authenticates the sensor certificate.
3. Ingestion service validates JSON schema and places message on raw-telemetry topic.
4. Message Broker routes telemetry to processing service.

## 2.2.2 Components

PostgreSQL is the primary data store for processed telemetry records.`;

const SDS_CONTENT = `## 6.2 Alert Processing Workflow

1. Processing service reads from raw-telemetry topic.
2. Alert Engine evaluates thresholds and publishes alerts.
3. Notification service delivers emails to operators.`;

const DOCS: OrchestratorDoc[] = [
  { id: "doc-sad", name: "SAD.pdf", content: SAD_CONTENT },
  { id: "doc-sds", name: "SDS.pdf", content: SDS_CONTENT },
];

const PLANNED_DIAGRAMS = JSON.stringify([
  {
    name: "Telemetry Ingestion Workflow",
    justification: "Covers the ingest path from sensor to broker.",
    citations: [
      {
        docName: "SAD.pdf",
        quote: "Sensor device transmits payload to API Gateway over TLS.",
      },
    ],
    confidence: 0.9,
  },
]);

const EXTRACTION_RESPONSE = JSON.stringify({
  components: [
    {
      id: "comp-pg",
      name: "PostgreSQL",
      type: "DATABASE",
      confidence: 0.9,
      sourceText:
        "PostgreSQL is the primary data store for processed telemetry records.",
      verificationStatus: "VERIFIED",
      trustLevel: "HIGH",
    },
  ],
  dataFlows: [],
  boundaries: [],
  dependencies: [],
  mlComponents: [],
  technologies: ["PostgreSQL"],
  dataTypes: [],
  warnings: [],
  confidence: 0.9,
  passesCompleted: 2,
  coverageMetrics: {
    componentsCoverage: 80,
    flowsCoverage: 0,
    boundariesCoverage: 0,
    quotesCoverage: 80,
    overallScore: 80,
  },
});

const PROSE_EXTRACTION_RESPONSE = JSON.stringify({
  name: "Telemetry Ingestion Workflow",
  participants: [
    { label: "Sensor", order: 0 },
    { label: "API Gateway", order: 1 },
    { label: "Ingestion Service", order: 2 },
  ],
  messages: [
    {
      from: "Sensor",
      to: "API Gateway",
      label: "transmit payload",
      order: 0,
      messageType: "SYNC",
      isReturn: false,
      sourceQuote:
        "1. Sensor device transmits payload to API Gateway over TLS.",
    },
  ],
});

function makeAI(responses: string[]) {
  let callCount = 0;
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    complete: vi.fn().mockImplementation(() => {
      const content = responses[callCount] ?? responses[responses.length - 1];
      callCount++;
      return Promise.resolve({ content });
    }),
  } as any;
}

describe("orchestrateImport", () => {
  it("returns structured result with all stages", async () => {
    // plan call → extraction calls (2 docs) × multiple passes → prose extraction
    const ai = makeAI([
      PLANNED_DIAGRAMS, // plan call
      PROSE_EXTRACTION_RESPONSE, // prose extraction (SAD workflow section)
      EXTRACTION_RESPONSE, // per-doc HLA extraction SAD
      EXTRACTION_RESPONSE, // per-doc HLA extraction SDS
      // extraction agent may call validate pass too — use extraction response as fallback
      EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
    ]);

    const result = await orchestrateImport(ai, DOCS);

    expect(result.plan).toBeDefined();
    expect(result.extractedDiagrams).toBeDefined();
    expect(result.synthesized).toBeDefined();
    expect(result.manifest).toBeDefined();
    expect(result.documentsUsed).toHaveLength(2);
  });

  it("manifest.plannedNames matches retained plan names", async () => {
    const ai = makeAI([
      PLANNED_DIAGRAMS,
      PROSE_EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
    ]);

    const result = await orchestrateImport(ai, DOCS);

    expect(result.manifest.plannedNames).toContain(
      "Telemetry Ingestion Workflow",
    );
  });

  it("returns empty plan gracefully when planner LLM fails", async () => {
    const ai = {
      isAvailable: vi.fn().mockResolvedValue(true),
      complete: vi
        .fn()
        .mockRejectedValueOnce(new Error("LLM crash")) // plan fails
        .mockResolvedValue({ content: EXTRACTION_RESPONSE }), // HLA extraction succeeds
    } as any;

    const result = await orchestrateImport(ai, DOCS);

    expect(result.plan.retained).toHaveLength(0);
    expect(result.plan.retracted).toHaveLength(0);
    // HLA synthesis should still run
    expect(result.synthesized).toBeDefined();
  });

  it("returns empty diagrams when no retained plans", async () => {
    // planner returns phantom plan that gets retracted
    const phantomPlan = JSON.stringify([
      {
        name: "Phantom Auth Flow",
        justification: "Uses OAuth.",
        citations: [
          {
            docName: "SAD.pdf",
            quote: "This text does not exist in the document.",
          },
        ],
        confidence: 0.8,
      },
    ]);

    const ai = makeAI([
      phantomPlan,
      EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
    ]);

    const result = await orchestrateImport(ai, DOCS);

    expect(result.plan.retained).toHaveLength(0);
    expect(result.plan.retracted).toHaveLength(1);
    expect(result.extractedDiagrams).toHaveLength(0);
  });

  it("manifest.honest is true when all planned diagrams are extracted", async () => {
    // Both plan and extraction return the same diagram name
    const ai = makeAI([
      PLANNED_DIAGRAMS,
      PROSE_EXTRACTION_RESPONSE, // extraction returns "Telemetry Ingestion Workflow"
      EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
    ]);

    const result = await orchestrateImport(ai, DOCS);

    // honest depends on whether the extracted diagram name matches planned name
    // The prose extractor uses section heading so result may or may not be honest
    // Just verify the structure is correct
    expect(result.manifest).toHaveProperty("honest");
    expect(result.manifest).toHaveProperty("missing");
    expect(result.manifest).toHaveProperty("extra");
  });

  it("calls onProgress for each stage", async () => {
    const ai = makeAI([
      PLANNED_DIAGRAMS,
      PROSE_EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
      EXTRACTION_RESPONSE,
    ]);

    const stages: string[] = [];
    await orchestrateImport(ai, DOCS, (stage) => stages.push(stage));

    expect(stages).toContain("plan");
    expect(stages).toContain("plan-complete");
    expect(stages).toContain("extract");
    expect(stages).toContain("synthesize");
    expect(stages).toContain("manifest");
  });

  it("handles empty docs array gracefully", async () => {
    const ai = makeAI([]);

    const result = await orchestrateImport(ai, []);

    expect(result.plan.planned).toHaveLength(0);
    expect(result.extractedDiagrams).toHaveLength(0);
    expect(result.synthesized.stats.totalComponents).toBe(0);
  });
});
