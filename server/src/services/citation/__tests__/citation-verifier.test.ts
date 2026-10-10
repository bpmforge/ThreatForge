import { describe, it, expect, vi } from "vitest";
import { computeRollup, verifyClaims } from "../citation-verifier.js";
import type { ClaimToVerify } from "../citation-verifier.js";
import { parseClaim } from "../citation-parser.js";

describe("computeRollup", () => {
  it("returns PENDING when no citations", () => {
    expect(computeRollup([])).toBe("PENDING");
  });

  it("returns VERIFIED when all are VERIFIED", () => {
    expect(computeRollup(["VERIFIED", "VERIFIED"])).toBe("VERIFIED");
  });

  it("returns VERIFIED when mix of VERIFIED + EXEMPT", () => {
    expect(computeRollup(["VERIFIED", "EXEMPT"])).toBe("VERIFIED");
  });

  it("returns UNVERIFIED if any UNVERIFIED", () => {
    expect(computeRollup(["VERIFIED", "UNVERIFIED"])).toBe("UNVERIFIED");
  });

  it("returns UNVERIFIED if any PHANTOM", () => {
    expect(computeRollup(["VERIFIED", "PHANTOM"])).toBe("UNVERIFIED");
  });

  it("returns PENDING if mix of VERIFIED + PENDING (no failures)", () => {
    expect(computeRollup(["VERIFIED", "PENDING"])).toBe("PENDING");
  });
});

// ---------------------------------------------------------------------------
// verifyClaims integration with mock Prisma + mock AI client
// ---------------------------------------------------------------------------

function makeMockPrisma(docs: { id: string; name: string; content: string }[]) {
  const citationCreates: any[] = [];
  const sectionCreateMany: any[] = [];
  const threatUpdates: any[] = [];
  const mitigationUpdates: any[] = [];
  const sectionsForDoc: Record<string, any[]> = {};

  return {
    citationCreates,
    sectionCreateMany,
    threatUpdates,
    mitigationUpdates,
    api: {
      document: {
        findMany: vi.fn().mockResolvedValue(docs),
      },
      documentSection: {
        findMany: vi.fn(({ where }: any) => {
          return Promise.resolve(sectionsForDoc[where.documentId] ?? []);
        }),
        createMany: vi.fn(({ data }: any) => {
          sectionCreateMany.push(...data);
          // Persist with synthetic ids so the second findMany returns rows
          for (const d of data) {
            sectionsForDoc[d.documentId] = (
              sectionsForDoc[d.documentId] ?? []
            ).concat({
              id: `sec_${sectionCreateMany.length}`,
              anchor: d.anchor,
              startOffset: d.startOffset,
              endOffset: d.endOffset,
            });
          }
          return Promise.resolve({ count: data.length });
        }),
      },
      citation: {
        create: vi.fn(({ data }: any) => {
          citationCreates.push(data);
          return Promise.resolve({
            id: `cit_${citationCreates.length}`,
            ...data,
          });
        }),
        findMany: vi.fn(({ where }: any) => {
          const owner = where.threatId ?? where.mitigationId;
          const matching = citationCreates.filter(
            (c) => c.threatId === owner || c.mitigationId === owner,
          );
          return Promise.resolve(
            matching.map((c) => ({ verificationStatus: c.verificationStatus })),
          );
        }),
      },
      threat: {
        update: vi.fn((args: any) => {
          threatUpdates.push(args);
          return Promise.resolve();
        }),
      },
      mitigation: {
        update: vi.fn((args: any) => {
          mitigationUpdates.push(args);
          return Promise.resolve();
        }),
      },
    },
  };
}

function makeAIClient(reply: string) {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    complete: vi.fn().mockResolvedValue({ content: reply }),
  } as any;
}

/**
 * Mock that inspects the prompt's Source block and echoes its first sentence
 * as the `quote`, so cross-check quote-validation always sees a verbatim match.
 * Use this whenever a test exercises a `supports: true` path.
 */
function makeEchoingAIClient(supports: boolean, confidence: number) {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    complete: vi.fn().mockImplementation(async ({ messages }: any) => {
      const prompt: string = messages[0].content;
      const m = prompt.match(/Source \([^)]+\):\s*"""\s*([\s\S]*?)\s*"""/);
      const source = m?.[1] ?? "";
      const firstSentence =
        source.split(/(?<=[.!?])\s+/)[0] ?? source.slice(0, 100);
      return {
        content: JSON.stringify({
          supports,
          confidence,
          quote: firstSentence,
          rationale: "mock",
        }),
      };
    }),
  } as any;
}

describe("verifyClaims (DOCUMENT type)", () => {
  const docs = [
    {
      id: "doc1",
      name: "srs.pdf",
      content: [
        "1 Introduction",
        "Intro body.",
        "",
        "3.2 Authentication",
        "The system stores user PII in the customers table for billing.",
        "",
        "5.1 Data Flow",
        "Requests flow from client to API to DB.",
      ].join("\n"),
    },
  ];

  it("marks claim VERIFIED when source supports it", async () => {
    const mock = makeMockPrisma(docs);
    const ai = makeEchoingAIClient(true, 0.9);
    const claims: ClaimToVerify[] = [
      {
        ownerType: "threat",
        ownerId: "t1",
        parsed: parseClaim("Per [doc:srs.pdf §3.2]: System stores PII."),
      },
    ];

    const summary = await verifyClaims(mock.api as any, ai, "tm1", claims);

    expect(summary).toEqual({
      total: 1,
      verified: 1,
      unverified: 0,
      phantom: 0,
      pending: 0,
    });
    expect(mock.citationCreates[0].verificationStatus).toBe("VERIFIED");
    expect(mock.citationCreates[0].documentId).toBe("doc1");
    expect(mock.threatUpdates[0].data.verificationStatus).toBe("VERIFIED");
  });

  it("marks claim UNVERIFIED when source does not support it", async () => {
    const mock = makeMockPrisma(docs);
    const ai = makeAIClient(
      '{"supports": false, "confidence": 0.85, "rationale": "no mention of encryption"}',
    );
    const claims: ClaimToVerify[] = [
      {
        ownerType: "threat",
        ownerId: "t1",
        parsed: parseClaim(
          "Per [doc:srs.pdf §3.2]: All data is encrypted at rest.",
        ),
      },
    ];

    const summary = await verifyClaims(mock.api as any, ai, "tm1", claims);
    expect(summary.unverified).toBe(1);
    expect(mock.citationCreates[0].verificationStatus).toBe("UNVERIFIED");
  });

  it("marks claim PHANTOM when document name is unknown", async () => {
    const mock = makeMockPrisma(docs);
    const ai = makeAIClient(
      '{"supports": true, "confidence": 1, "rationale": ""}',
    );
    const claims: ClaimToVerify[] = [
      {
        ownerType: "threat",
        ownerId: "t1",
        parsed: parseClaim("Per [doc:nonexistent.pdf §1]: claim."),
      },
    ];

    const summary = await verifyClaims(mock.api as any, ai, "tm1", claims);
    expect(summary.phantom).toBe(1);
    expect(mock.citationCreates[0].verificationStatus).toBe("PHANTOM");
    // Provider must NOT be called when doc resolution fails
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it("marks claim PHANTOM when section anchor is unknown", async () => {
    const mock = makeMockPrisma(docs);
    const ai = makeAIClient(
      '{"supports": true, "confidence": 1, "rationale": ""}',
    );
    const claims: ClaimToVerify[] = [
      {
        ownerType: "threat",
        ownerId: "t1",
        parsed: parseClaim("Per [doc:srs.pdf §99.99]: claim."),
      },
    ];

    const summary = await verifyClaims(mock.api as any, ai, "tm1", claims);
    expect(summary.phantom).toBe(1);
    expect(mock.citationCreates[0].documentId).toBe("doc1");
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it("marks claim UNVERIFIED when no citation provided", async () => {
    const mock = makeMockPrisma(docs);
    const ai = makeAIClient(
      '{"supports": true, "confidence": 1, "rationale": ""}',
    );
    const claims: ClaimToVerify[] = [
      {
        ownerType: "threat",
        ownerId: "t1",
        parsed: parseClaim("Just a claim with no citation."),
      },
    ];

    const summary = await verifyClaims(mock.api as any, ai, "tm1", claims);
    expect(summary.unverified).toBe(1);
    expect(mock.citationCreates[0].verificationStatus).toBe("UNVERIFIED");
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it("respects 'Not found:' kind by marking citation EXEMPT", async () => {
    const mock = makeMockPrisma(docs);
    const ai = makeAIClient("");
    const claims: ClaimToVerify[] = [
      {
        ownerType: "threat",
        ownerId: "t1",
        parsed: parseClaim("Not found: encryption-at-rest details."),
      },
    ];

    await verifyClaims(mock.api as any, ai, "tm1", claims);
    expect(mock.citationCreates[0].verificationStatus).toBe("EXEMPT");
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it("falls back to UNVERIFIED on provider failure (network error)", async () => {
    const mock = makeMockPrisma(docs);
    const ai = {
      isAvailable: vi.fn().mockResolvedValue(true),
      complete: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    } as any;
    const claims: ClaimToVerify[] = [
      {
        ownerType: "threat",
        ownerId: "t1",
        parsed: parseClaim("Per [doc:srs.pdf §3.2]: claim."),
      },
    ];

    const summary = await verifyClaims(mock.api as any, ai, "tm1", claims);
    expect(summary.unverified).toBe(1);
    expect(mock.citationCreates[0].verifierRationale).toMatch(
      /provider error/i,
    );
  });

  it("threshold gate: confidence below threshold → UNVERIFIED", async () => {
    const mock = makeMockPrisma(docs);
    const ai = makeEchoingAIClient(true, 0.5);
    const claims: ClaimToVerify[] = [
      {
        ownerType: "threat",
        ownerId: "t1",
        parsed: parseClaim("Per [doc:srs.pdf §3.2]: claim."),
      },
    ];

    const summary = await verifyClaims(mock.api as any, ai, "tm1", claims, {
      confidenceThreshold: 0.7,
    });
    expect(summary.unverified).toBe(1);
  });

  it("writes mitigation citation with mitigationId (not threatId)", async () => {
    const mock = makeMockPrisma(docs);
    const ai = makeEchoingAIClient(true, 0.9);
    const claims: ClaimToVerify[] = [
      {
        ownerType: "mitigation",
        ownerId: "m1",
        parsed: parseClaim("Per [doc:srs.pdf §3.2]: enforce TLS."),
      },
    ];

    await verifyClaims(mock.api as any, ai, "tm1", claims);
    expect(mock.citationCreates[0].mitigationId).toBe("m1");
    expect(mock.citationCreates[0].threatId).toBeUndefined();
    expect(mock.mitigationUpdates[0].data.verificationStatus).toBe("VERIFIED");
  });

  it("rollup degrades: one UNVERIFIED among multiple cites → owner UNVERIFIED", async () => {
    const mock = makeMockPrisma(docs);
    let callIdx = 0;
    const ai = {
      isAvailable: vi.fn().mockResolvedValue(true),
      complete: vi.fn().mockImplementation(({ messages }: any) => {
        callIdx++;
        const m = messages[0].content.match(
          /Source \([^)]+\):\s*"""\s*([\s\S]*?)\s*"""/,
        );
        const source = m?.[1] ?? "";
        const firstSentence =
          source.split(/(?<=[.!?])\s+/)[0] ?? source.slice(0, 100);
        return Promise.resolve({
          content: JSON.stringify(
            callIdx === 1
              ? {
                  supports: true,
                  confidence: 0.9,
                  quote: firstSentence,
                  rationale: "ok",
                }
              : {
                  supports: false,
                  confidence: 0.9,
                  quote: "",
                  rationale: "miss",
                },
          ),
        });
      }),
    } as any;
    const claims: ClaimToVerify[] = [
      {
        ownerType: "threat",
        ownerId: "t1",
        parsed: parseClaim("Per [doc:srs.pdf §3.2]: claim. [doc:srs.pdf §5.1]"),
      },
    ];

    await verifyClaims(mock.api as any, ai, "tm1", claims);
    // Two citation rows — VERIFIED then UNVERIFIED
    const statuses = mock.citationCreates.map((c) => c.verificationStatus);
    expect(statuses).toContain("VERIFIED");
    expect(statuses).toContain("UNVERIFIED");
    // Owner rollup is UNVERIFIED
    const lastUpdate =
      mock.threatUpdates[mock.threatUpdates.length - 1].data.verificationStatus;
    expect(lastUpdate).toBe("UNVERIFIED");
  });
});
