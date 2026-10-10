import { describe, it, expect, vi } from "vitest";
import { previewVerifyClaims } from "../preview-verifier.js";
import { parseClaim } from "../citation-parser.js";

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

function makePrisma(componentNodeIds: string[] = [], reqIds: string[] = []) {
  return {
    document: {
      findMany: vi.fn().mockResolvedValue(docs),
    },
    component: {
      findMany: vi
        .fn()
        .mockResolvedValue(componentNodeIds.map((nodeId) => ({ nodeId }))),
    },
    requirement: {
      findMany: vi.fn().mockResolvedValue(reqIds.map((reqId) => ({ reqId }))),
    },
  } as any;
}

function makeAI(reply: string) {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    complete: vi.fn().mockResolvedValue({ content: reply }),
  } as any;
}

/**
 * Mock that echoes the first sentence from the source block of the prompt
 * as `quote`, so cross-check validation sees a verbatim match for any
 * source the verifier feeds in.
 */
function makeEchoingAI(supports: boolean, confidence: number) {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    complete: vi.fn().mockImplementation(async ({ messages }: any) => {
      const prompt: string = messages[0].content;
      const sourceMatch = prompt.match(
        /Source \([^)]+\):\s*"""\s*([^]*?)\s*"""/,
      );
      const sourceBlock = sourceMatch?.[1] ?? "";
      const firstSentence =
        sourceBlock.split(/(?<=[.!?])\s+/)[0] ?? sourceBlock.slice(0, 100);
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

describe("previewVerifyClaims", () => {
  it("returns VERIFIED when source supports the claim — no DB writes", async () => {
    const prisma = makePrisma();
    const ai = makeAI(
      '{"supports": true, "confidence": 0.9, "quote": "The system stores user PII in the customers table for billing.", "rationale": "direct evidence"}',
    );

    const claims = [parseClaim("Per [doc:srs.pdf §3.2]: System stores PII.")];
    const results = await previewVerifyClaims(prisma, ai, "tm1", claims);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("VERIFIED");
    expect(results[0].citations[0]).toMatchObject({
      type: "DOCUMENT",
      documentName: "srs.pdf",
      sectionAnchor: "3.2",
      status: "VERIFIED",
      confidence: 0.9,
    });
    // No DB write functions called — preview is read-only on prisma
    // (only document.findMany was used)
    expect(prisma.document.findMany).toHaveBeenCalledOnce();
  });

  it("returns PHANTOM for an unknown document name without calling AI", async () => {
    const prisma = makePrisma();
    const ai = makeAI('{"supports": true, "confidence": 1, "rationale": ""}');
    const claims = [parseClaim("Per [doc:nonexistent.pdf §1]: claim.")];

    const results = await previewVerifyClaims(prisma, ai, "tm1", claims);

    expect(results[0].status).toBe("PHANTOM");
    expect(results[0].citations[0].rationale).toMatch(/not found/i);
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it("returns PHANTOM for unknown section without calling AI", async () => {
    const prisma = makePrisma();
    const ai = makeAI('{"supports": true, "confidence": 1, "rationale": ""}');
    const claims = [parseClaim("Per [doc:srs.pdf §99.99]: claim.")];

    const results = await previewVerifyClaims(prisma, ai, "tm1", claims);

    expect(results[0].status).toBe("PHANTOM");
    expect(results[0].citations[0].sectionAnchor).toBe("99.99");
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it("returns UNVERIFIED for claims with no citation", async () => {
    const prisma = makePrisma();
    const ai = makeAI('{"supports": true, "confidence": 1, "rationale": ""}');
    const claims = [parseClaim("Just plain text, no citation.")];

    const results = await previewVerifyClaims(prisma, ai, "tm1", claims);

    expect(results[0].status).toBe("UNVERIFIED");
    expect(results[0].citations[0].type).toBe("NONE");
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it("returns EXEMPT for 'Not found:' claims", async () => {
    const prisma = makePrisma();
    const ai = makeAI("");
    const claims = [parseClaim("Not found: encryption-at-rest details.")];

    const results = await previewVerifyClaims(prisma, ai, "tm1", claims);

    expect(results[0].status).toBe("EXEMPT");
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it("batches multiple claims and reuses the per-doc section index", async () => {
    const prisma = makePrisma();
    const ai = makeEchoingAI(true, 0.85);
    const claims = [
      parseClaim("Per [doc:srs.pdf §3.2]: PII storage."),
      parseClaim("Per [doc:srs.pdf §5.1]: Data flow direction."),
    ];

    const results = await previewVerifyClaims(prisma, ai, "tm1", claims);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === "VERIFIED")).toBe(true);
    // Document loaded once for the batch
    expect(prisma.document.findMany).toHaveBeenCalledOnce();
  });

  it("threshold gate: low-confidence supports → UNVERIFIED", async () => {
    const prisma = makePrisma();
    const ai = makeAI(
      '{"supports": true, "confidence": 0.4, "rationale": "weak"}',
    );
    const claims = [parseClaim("Per [doc:srs.pdf §3.2]: PII.")];

    const results = await previewVerifyClaims(prisma, ai, "tm1", claims, {
      confidenceThreshold: 0.7,
    });

    expect(results[0].status).toBe("UNVERIFIED");
  });

  it("COMPONENT citation: VERIFIED when nodeId is on the canvas", async () => {
    const prisma = makePrisma(["web-frontend", "api"]);
    const ai = makeAI("");
    const claims = [
      parseClaim("[component:web-frontend] is exposed publicly."),
    ];

    const results = await previewVerifyClaims(prisma, ai, "tm1", claims);
    expect(results[0].status).toBe("VERIFIED");
    expect(results[0].citations[0]).toMatchObject({
      type: "COMPONENT",
      componentNodeId: "web-frontend",
      status: "VERIFIED",
    });
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it("REQUIREMENT citation: VERIFIED when reqId exists in this threat model", async () => {
    const prisma = makePrisma([], ["FR-12", "SEC-3"]);
    const ai = makeAI("");
    const claims = [parseClaim("[req:FR-12] TLS 1.3 satisfies FR-12.")];

    const results = await previewVerifyClaims(prisma, ai, "tm1", claims);
    expect(results[0].status).toBe("VERIFIED");
    expect(results[0].citations[0]).toMatchObject({
      type: "REQUIREMENT",
      requirementId: "FR-12",
      status: "VERIFIED",
    });
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it("REQUIREMENT citation: PHANTOM when reqId is not imported", async () => {
    const prisma = makePrisma([], ["FR-12"]);
    const ai = makeAI("");
    const claims = [parseClaim("[req:REQ-999] unknown requirement id.")];

    const results = await previewVerifyClaims(prisma, ai, "tm1", claims);
    expect(results[0].status).toBe("PHANTOM");
    expect(results[0].citations[0].rationale).toMatch(/not found/);
  });

  it("COMPONENT citation: PHANTOM when nodeId is NOT on the canvas", async () => {
    const prisma = makePrisma(["web-frontend"]);
    const ai = makeAI("");
    const claims = [parseClaim("[component:does-not-exist] is exposed.")];

    const results = await previewVerifyClaims(prisma, ai, "tm1", claims);
    expect(results[0].status).toBe("PHANTOM");
    expect(results[0].citations[0].rationale).toMatch(/not found on canvas/);
  });

  it("REFERENCE + COMPONENT mix in one claim — degrades to PHANTOM if any fails", async () => {
    const prisma = makePrisma(["web-frontend"]);
    const ai = makeAI("");
    const claims = [
      parseClaim(
        "[ref:CWE-89] applies to [component:nonexistent-node] via SQL injection.",
      ),
    ];

    const results = await previewVerifyClaims(prisma, ai, "tm1", claims);
    // CWE-89 → VERIFIED, nonexistent-node → PHANTOM, rollup → PHANTOM
    expect(results[0].status).toBe("PHANTOM");
    expect(results[0].citations).toHaveLength(2);
  });

  it("provider error → UNVERIFIED, never throws", async () => {
    const prisma = makePrisma();
    const ai = {
      isAvailable: vi.fn().mockResolvedValue(true),
      complete: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    } as any;
    const claims = [parseClaim("Per [doc:srs.pdf §3.2]: claim.")];

    const results = await previewVerifyClaims(prisma, ai, "tm1", claims);

    expect(results[0].status).toBe("UNVERIFIED");
    expect(results[0].citations[0].rationale).toMatch(/provider error/i);
  });
});
