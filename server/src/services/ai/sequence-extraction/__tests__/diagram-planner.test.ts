import { describe, it, expect, vi } from "vitest";
import { planDiagrams } from "../diagram-planner.js";
import type { SourceDoc } from "../diagram-planner.js";

const SAD_CONTENT = `## 3.2 Telemetry Ingestion Workflow
Sensor device transmits payload to API Gateway over TLS.
API Gateway authenticates the sensor certificate.
Ingestion service validates JSON schema and places message on raw-telemetry topic.
Message Broker routes telemetry to processing service.`;

const SDS_CONTENT = `## 6.2 Alert Processing
Processing service reads from raw-telemetry topic.
Alert Engine evaluates thresholds and publishes alerts to alert-events topic.
Notification service consumes alert-events and delivers emails.`;

const DOCS: SourceDoc[] = [
  { name: "SAD.pdf", content: SAD_CONTENT },
  { name: "SDS.pdf", content: SDS_CONTENT },
];

function makeAI(content: string) {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    complete: vi.fn().mockResolvedValue({ content }),
  } as any;
}

function rejectingAI() {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    complete: vi.fn().mockRejectedValue(new Error("LLM crashed")),
  } as any;
}

const VALID_PLAN_JSON = JSON.stringify([
  {
    name: "Telemetry Ingestion Flow",
    justification: "Covers the ingest path from sensor to broker.",
    citations: [
      {
        docName: "SAD.pdf",
        quote: "Sensor device transmits payload to API Gateway over TLS.",
      },
    ],
    confidence: 0.9,
  },
  {
    name: "Alert Processing Flow",
    justification: "Covers alert evaluation and notification delivery.",
    citations: [
      {
        docName: "SDS.pdf",
        quote:
          "Alert Engine evaluates thresholds and publishes alerts to alert-events topic.",
      },
    ],
    confidence: 0.88,
  },
]);

describe("planDiagrams", () => {
  it("retains plans whose citations substring-match the source docs", async () => {
    const ai = makeAI(VALID_PLAN_JSON);
    const result = await planDiagrams(ai, DOCS);

    expect(result.retained).toHaveLength(2);
    expect(result.retracted).toHaveLength(0);
    expect(result.retained[0].name).toBe("Telemetry Ingestion Flow");
    expect(result.retained[0].defenseStatus).toBe("RETAINED");
  });

  it("retracts plans whose citations cannot be found in source docs", async () => {
    const phantomPlan = JSON.stringify([
      {
        name: "Phantom OAuth Flow",
        justification: "OAuth is used for authentication.",
        citations: [
          {
            docName: "SAD.pdf",
            quote: "Users log in via OAuth2 authorization code flow.",
          },
        ],
        confidence: 0.85,
      },
    ]);
    const ai = makeAI(phantomPlan);
    const result = await planDiagrams(ai, DOCS);

    expect(result.retained).toHaveLength(0);
    expect(result.retracted).toHaveLength(1);
    expect(result.retracted[0].defenseStatus).toBe("RETRACTED");
    expect(result.retracted[0].failedCitations).toHaveLength(1);
  });

  it("partially defends: drops bad citations but retains plan if ≥1 citation survives", async () => {
    const mixedPlan = JSON.stringify([
      {
        name: "Telemetry Ingestion Flow",
        justification: "Sensor to broker flow.",
        citations: [
          {
            docName: "SAD.pdf",
            quote: "Sensor device transmits payload to API Gateway over TLS.",
          },
          {
            docName: "SAD.pdf",
            quote: "This sentence does not exist anywhere in the document.",
          },
        ],
        confidence: 0.9,
      },
    ]);
    const ai = makeAI(mixedPlan);
    const result = await planDiagrams(ai, DOCS);

    expect(result.retained).toHaveLength(1);
    expect(result.retained[0].citations).toHaveLength(1);
    expect(result.retained[0].failedCitations).toHaveLength(1);
  });

  it("retracts plans citing a doc not in the provided docs list", async () => {
    const unknownDocPlan = JSON.stringify([
      {
        name: "SSO Flow",
        justification: "SSO is documented in auth spec.",
        citations: [{ docName: "AUTH_SPEC.pdf", quote: "SSO login via SAML." }],
        confidence: 0.8,
      },
    ]);
    const ai = makeAI(unknownDocPlan);
    const result = await planDiagrams(ai, DOCS);

    expect(result.retained).toHaveLength(0);
    expect(result.retracted).toHaveLength(1);
  });

  it("returns empty result when no docs provided", async () => {
    const ai = makeAI(VALID_PLAN_JSON);
    const result = await planDiagrams(ai, []);

    expect(result.planned).toHaveLength(0);
    expect(result.retained).toHaveLength(0);
  });

  it("returns empty result when LLM call fails", async () => {
    const result = await planDiagrams(rejectingAI(), DOCS);

    expect(result.planned).toHaveLength(0);
    expect(result.retained).toHaveLength(0);
  });

  it("handles LLM returning invalid JSON gracefully", async () => {
    const ai = makeAI("Not valid JSON at all {{");
    const result = await planDiagrams(ai, DOCS);

    expect(result.planned).toHaveLength(0);
  });

  it("strips thinking blocks from LLM output before parsing", async () => {
    const ai = makeAI(
      `<think>Let me think about this...</think>\n${VALID_PLAN_JSON}`,
    );
    const result = await planDiagrams(ai, DOCS);

    expect(result.retained).toHaveLength(2);
  });

  it("strips markdown code fences from LLM output", async () => {
    const ai = makeAI("```json\n" + VALID_PLAN_JSON + "\n```");
    const result = await planDiagrams(ai, DOCS);

    expect(result.retained).toHaveLength(2);
  });

  it("clamps confidence to [0, 1] range", async () => {
    const weirdConfidence = JSON.stringify([
      {
        name: "Some Flow",
        justification: "It exists.",
        citations: [
          {
            docName: "SAD.pdf",
            quote: "Sensor device transmits payload to API Gateway over TLS.",
          },
        ],
        confidence: 99,
      },
    ]);
    const ai = makeAI(weirdConfidence);
    const result = await planDiagrams(ai, DOCS);

    expect(result.retained[0].confidence).toBe(1);
  });

  it("drops citations shorter than 8 chars", async () => {
    const shortCitation = JSON.stringify([
      {
        name: "Some Flow",
        justification: "Has a short citation.",
        citations: [{ docName: "SAD.pdf", quote: "Hi" }],
        confidence: 0.8,
      },
    ]);
    const ai = makeAI(shortCitation);
    const result = await planDiagrams(ai, DOCS);

    expect(result.retracted).toHaveLength(1);
  });

  it("populates planned with all plans before defend", async () => {
    const ai = makeAI(VALID_PLAN_JSON);
    const result = await planDiagrams(ai, DOCS);

    expect(result.planned).toHaveLength(2);
  });
});
