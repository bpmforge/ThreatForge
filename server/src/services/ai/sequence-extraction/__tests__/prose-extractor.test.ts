import { describe, it, expect, vi } from "vitest";
import { extractProseSequence } from "../prose-extractor.js";
import type { DetectedProseSequence } from "../prose-detector.js";

const SAMPLE_SECTION: DetectedProseSequence = {
  heading: "Software Process Workflow",
  headingLevel: 3,
  steps: [
    {
      number: 1,
      text: "Sensor device transmits payload.",
      sourceQuote: "1. Sensor device transmits payload.",
    },
    {
      number: 2,
      text: "API Gateway authenticates sensor certificate.",
      sourceQuote: "2. API Gateway authenticates sensor certificate.",
    },
    {
      number: 3,
      text: "Ingestion service validates JSON schema.",
      sourceQuote: "3. Ingestion service validates JSON schema.",
    },
  ],
  sourceQuote:
    "### 3.2 Software Process Workflow\n1. Sensor device transmits payload.\n2. API Gateway authenticates sensor certificate.\n3. Ingestion service validates JSON schema.",
};

function makeAI(content: string) {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    complete: vi.fn().mockResolvedValue({ content }),
  } as any;
}

function rejectingAI(err: Error) {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    complete: vi.fn().mockRejectedValue(err),
  } as any;
}

describe("extractProseSequence", () => {
  it("converts a well-structured LLM response into a SequenceDiagram", async () => {
    const ai = makeAI(
      JSON.stringify({
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
            label: "transmits payload",
            order: 0,
            messageType: "ASYNC",
            isReturn: false,
            sourceQuote: "1. Sensor device transmits payload.",
          },
          {
            from: "API Gateway",
            to: "Ingestion Service",
            label: "forwards authenticated payload",
            order: 1,
            messageType: "SYNC",
            isReturn: false,
            sourceQuote: "2. API Gateway authenticates sensor certificate.",
          },
        ],
      }),
    );

    const r = await extractProseSequence(ai, SAMPLE_SECTION);
    expect(r).not.toBeNull();
    expect(r?.format).toBe("prose");
    expect(r?.name).toBe("Telemetry Ingestion Workflow");
    expect(r?.participants.map((p) => p.label)).toEqual([
      "Sensor",
      "API Gateway",
      "Ingestion Service",
    ]);
    expect(r?.messages).toHaveLength(2);
    expect(r?.messages[0]).toMatchObject({
      from: "Sensor",
      to: "API Gateway",
      messageType: "ASYNC",
    });
  });

  it("preserves the section's full sourceQuote on the diagram", async () => {
    const ai = makeAI(
      JSON.stringify({
        name: "Flow",
        participants: [],
        messages: [
          {
            from: "A",
            to: "B",
            label: "x",
            sourceQuote: "1. Sensor device transmits payload.",
          },
        ],
      }),
    );
    const r = await extractProseSequence(ai, SAMPLE_SECTION);
    expect(r?.sourceQuote).toBe(SAMPLE_SECTION.sourceQuote);
  });

  it("drops messages whose sourceQuote isn't a verbatim input step", async () => {
    const ai = makeAI(
      JSON.stringify({
        name: "Flow",
        participants: [],
        messages: [
          {
            from: "Sensor",
            to: "API Gateway",
            label: "real",
            sourceQuote: "1. Sensor device transmits payload.",
          },
          {
            from: "Ghost",
            to: "Phantom",
            label: "fabricated",
            sourceQuote: "99. Some step that was never in the document.",
          },
        ],
      }),
    );
    const r = await extractProseSequence(ai, SAMPLE_SECTION);
    expect(r?.messages).toHaveLength(1);
    expect(r?.messages[0].label).toBe("real");
  });

  it("drops messages that PREPEND truth to fabrication (closes the prepend hole)", async () => {
    // The LLM quotes a real step but appends speculation. Old bidirectional
    // matcher accepted this; new one-directional matcher must reject it.
    const ai = makeAI(
      JSON.stringify({
        name: "Flow",
        participants: [],
        messages: [
          {
            from: "Sensor",
            to: "Attacker",
            label: "exfiltrates payload",
            sourceQuote:
              "1. Sensor device transmits payload. Attacker then intercepts the payload over the wire.",
          },
        ],
      }),
    );
    const r = await extractProseSequence(ai, SAMPLE_SECTION);
    expect(r).toBeNull();
  });

  it("returns null when the LLM produced zero verifiable messages", async () => {
    const ai = makeAI(
      JSON.stringify({
        name: "Flow",
        participants: [],
        messages: [
          {
            from: "X",
            to: "Y",
            label: "all fabricated",
            sourceQuote: "Not in the input at all",
          },
        ],
      }),
    );
    const r = await extractProseSequence(ai, SAMPLE_SECTION);
    expect(r).toBeNull();
  });

  it("returns null when the LLM call throws", async () => {
    const ai = rejectingAI(new Error("ECONNREFUSED"));
    const r = await extractProseSequence(ai, SAMPLE_SECTION);
    expect(r).toBeNull();
  });

  it("returns null when the LLM emits non-JSON garbage", async () => {
    const ai = makeAI("Sure! Here's the diagram. (no JSON)");
    expect(await extractProseSequence(ai, SAMPLE_SECTION)).toBeNull();
  });

  it("backfills participants referenced in messages but missing from the participants array", async () => {
    const ai = makeAI(
      JSON.stringify({
        name: "Flow",
        // LLM forgot to declare API Gateway in participants
        participants: [{ label: "Sensor", order: 0 }],
        messages: [
          {
            from: "Sensor",
            to: "API Gateway",
            label: "transmits",
            sourceQuote: "1. Sensor device transmits payload.",
          },
        ],
      }),
    );
    const r = await extractProseSequence(ai, SAMPLE_SECTION);
    expect(r?.participants.map((p) => p.label)).toContain("API Gateway");
    expect(r?.participants.map((p) => p.label)).toContain("Sensor");
  });

  it("normalizes messageType and defaults to SYNC for unknown values", async () => {
    const ai = makeAI(
      JSON.stringify({
        messages: [
          {
            from: "A",
            to: "B",
            label: "x",
            messageType: "weird",
            sourceQuote: "1. Sensor device transmits payload.",
          },
        ],
      }),
    );
    const r = await extractProseSequence(ai, SAMPLE_SECTION);
    expect(r?.messages[0].messageType).toBe("SYNC");
  });

  it("tolerates LLM responses wrapped in markdown code fences", async () => {
    const ai = makeAI(
      "```json\n" +
        JSON.stringify({
          messages: [
            {
              from: "A",
              to: "B",
              label: "x",
              sourceQuote: "1. Sensor device transmits payload.",
            },
          ],
        }) +
        "\n```",
    );
    const r = await extractProseSequence(ai, SAMPLE_SECTION);
    expect(r?.messages).toHaveLength(1);
  });

  it("uses the section heading as fallback name when LLM omits one", async () => {
    const ai = makeAI(
      JSON.stringify({
        messages: [
          {
            from: "A",
            to: "B",
            label: "x",
            sourceQuote: "1. Sensor device transmits payload.",
          },
        ],
      }),
    );
    const r = await extractProseSequence(ai, SAMPLE_SECTION);
    expect(r?.name).toBe("Software Process Workflow");
  });
});
