import { describe, it, expect, vi } from "vitest";
import {
  generateMitigationsForComponent,
  MITIGATION_BATCH_SIZE,
} from "../mitigation-analyzer.js";
import type { MicroThreat } from "../types.js";
import type { ComponentContext } from "../../../threat-generation/context-aware-pipeline.js";

// mitigations go out MITIGATION_BATCH_SIZE threats per call, keyed by
// the threat's number in the batch, instead of one call per threat.

const component: ComponentContext = {
  id: "node-api",
  name: "Public API",
  type: "SERVICE",
  technologyVersion: "Express 4",
  dataClassification: "CONFIDENTIAL",
  dataTypes: ["PII"],
  complianceFrameworks: [],
  existingControls: [],
  inbound: [],
  outbound: [],
} as unknown as ComponentContext;

function threat(i: number): MicroThreat {
  return {
    name: `Threat ${i}`,
    description: `Description ${i}`,
    category: "TAMPERING",
    severity: "HIGH",
    componentId: "node-api",
    componentName: "Public API",
    cweIds: ["CWE-20"],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "MEDIUM", effectiveness: "0.5" },
    confidence: 0.8,
    sourceMethodology: "stride",
  };
}

const mit = (label: string) => ({
  description: `Control for ${label}`,
  controlCategory: "INPUT_VALIDATION",
  testCriteria: `Verify ${label}`,
  effectiveness: 0.5,
  suggestedRequirement: null,
});

/** Replies to a batch prompt with one mitigation per "### Threat N" header. */
function replyAll(_system: string, user: string): Promise<string> {
  const names = [...user.matchAll(/### Threat (\d+)\nName: (.+)/g)];
  return Promise.resolve(
    JSON.stringify(
      names.map(([, n, name]) => ({
        threat: Number(n),
        mitigations: [mit(name)],
      })),
    ),
  );
}

describe("generateMitigationsForComponent — batching", () => {
  it("sends ceil(n / batch size) calls and maps each reply entry to its threat", async () => {
    const aiCall = vi.fn(replyAll);
    const threats = Array.from({ length: 7 }, (_, i) => threat(i + 1));

    const out = await generateMitigationsForComponent(
      aiCall,
      component,
      threats,
    );

    expect(MITIGATION_BATCH_SIZE).toBe(3);
    expect(aiCall).toHaveBeenCalledTimes(3);
    expect(aiCall.mock.calls[0][1]).toContain("### Threat 3");
    expect(aiCall.mock.calls[0][1]).not.toContain("### Threat 4");
    expect(aiCall.mock.calls[2][1]).toContain("Name: Threat 7");
    expect(new Set(aiCall.mock.calls.map((c) => c[0])).size).toBe(1);
    out.forEach((t, i) => {
      expect(t.mitigations).toHaveLength(1);
      expect(t.mitigations[0].description).toBe(`Control for Threat ${i + 1}`);
      expect(t.mitigation.description).toBe(`Control for Threat ${i + 1}`);
    });
  });

  it("accepts a batch reply that only lacks its closing bracket", async () => {
    // Seen on 16 of 57 batches in a recorded run: complete JSON ending
    // `}]}` with the outer `]` missing.
    const withReq = (label: string) => ({
      ...mit(label),
      suggestedRequirement: { text: `MUST ${label}`, category: "security" },
    });
    const unclosed = JSON.stringify([
      { threat: 1, mitigations: [withReq("Threat 1"), withReq("Threat 1b")] },
      { threat: 2, mitigations: [withReq("Threat 2")] },
    ]).slice(0, -1);
    const aiCall = vi.fn().mockResolvedValue(unclosed);

    const out = await generateMitigationsForComponent(aiCall, component, [
      threat(1),
      threat(2),
    ]);

    expect(aiCall).toHaveBeenCalledTimes(1);
    expect(out.map((t) => t.mitigations[0]?.description)).toEqual([
      "Control for Threat 1",
      "Control for Threat 2",
    ]);
  });

  it("retries a truncated batch one threat per call, accepting a bare mitigation array", async () => {
    // Cut off mid-reply: the parser can only recover the inner mitigation
    // objects, which carry no threat number, so the whole batch is lost.
    const truncated = `[{"threat":1,"mitigations":[${JSON.stringify(mit("Threat 1"))},{"descr`;
    const aiCall = vi
      .fn<(s: string, u: string) => Promise<string>>()
      .mockResolvedValueOnce(truncated)
      .mockImplementation(async (_s, user) => {
        const name = /Name: (.+)/.exec(user)?.[1] ?? "";
        return JSON.stringify([mit(name)]);
      });

    const out = await generateMitigationsForComponent(aiCall, component, [
      threat(1),
      threat(2),
    ]);

    expect(aiCall).toHaveBeenCalledTimes(3);
    expect(aiCall.mock.calls[1][1]).not.toContain("Name: Threat 2");
    expect(aiCall.mock.calls[2][1]).not.toContain("Name: Threat 1");
    expect(out.map((t) => t.mitigations[0]?.description)).toEqual([
      "Control for Threat 1",
      "Control for Threat 2",
    ]);
  });

  it("retries the threats a reply left out, once, one call each", async () => {
    const aiCall = vi
      .fn<(s: string, u: string) => Promise<string>>()
      .mockResolvedValueOnce(
        JSON.stringify([
          { threat: 1, mitigations: [mit("Threat 1")] },
          { threat: 3, mitigations: [mit("Threat 3")] },
        ]),
      )
      .mockImplementation(replyAll);
    const threats = [threat(1), threat(2), threat(3)];

    const out = await generateMitigationsForComponent(
      aiCall,
      component,
      threats,
    );

    expect(aiCall).toHaveBeenCalledTimes(2);
    const retryUser = aiCall.mock.calls[1][1];
    expect(retryUser).toContain("Name: Threat 2");
    expect(retryUser).not.toContain("Name: Threat 1");
    expect(out.map((t) => t.mitigations[0]?.description)).toEqual([
      "Control for Threat 1",
      "Control for Threat 2",
      "Control for Threat 3",
    ]);
  });

  it("keeps existing mitigations when the call fails and the retry fails", async () => {
    const aiCall = vi.fn().mockRejectedValue(new Error("HTTP 507"));
    const existing = threat(1);
    existing.mitigations = [
      {
        description: "Prior control",
        controlCategory: "IAM",
        testCriteria: "Verify prior",
        effort: "LOW",
        effectiveness: "0.4",
      },
    ];

    const out = await generateMitigationsForComponent(aiCall, component, [
      existing,
      threat(2),
    ]);

    expect(aiCall).toHaveBeenCalledTimes(3);
    expect(out[0].mitigations[0].description).toBe("Prior control");
    expect(out[1].mitigations).toEqual([]);
  });

  it("ignores reply entries whose threat number is outside the batch", async () => {
    const aiCall = vi
      .fn<(s: string, u: string) => Promise<string>>()
      .mockResolvedValue(
        JSON.stringify([
          { threat: 0, mitigations: [mit("zero")] },
          { threat: 2, mitigations: [mit("two")] },
          { threat: "x", mitigations: [mit("x")] },
        ]),
      );

    const out = await generateMitigationsForComponent(aiCall, component, [
      threat(1),
    ]);

    expect(out[0].mitigations).toEqual([]);
  });
});
