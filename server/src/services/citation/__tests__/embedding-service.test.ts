import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  cosineSimilarity,
  serializeEmbedding,
  deserializeEmbedding,
  semanticMatch,
  embedDocumentSections,
  type EmbeddingConfig,
} from "../embedding-service.js";

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const v = [1, 0, 0];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("returns 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("handles negative components", () => {
    const sim = cosineSimilarity([1, -1], [-1, 1]);
    expect(sim).toBeCloseTo(-1);
  });
});

// ---------------------------------------------------------------------------
// Serialization round-trip
// ---------------------------------------------------------------------------

describe("serializeEmbedding / deserializeEmbedding", () => {
  it("round-trips a float vector", () => {
    const original = [0.1, 0.5, -0.3, 1.0, -1.0];
    const buf = serializeEmbedding(original);
    const restored = deserializeEmbedding(buf);
    expect(restored).toHaveLength(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(restored[i]).toBeCloseTo(original[i], 5);
    }
  });

  it("produces 4 bytes per dimension", () => {
    const v = [1, 2, 3, 4];
    expect(serializeEmbedding(v).length).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// semanticMatch
// ---------------------------------------------------------------------------

const cfg: EmbeddingConfig = {
  baseUrl: "http://localhost:1234/v1",
  model: "nomic-embed-text",
  maxChars: 2000,
  threshold: 0.6,
};

describe("semanticMatch", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("fails open (matches: true) when sectionEmbedding is null", async () => {
    const result = await semanticMatch("some claim", null, cfg);
    expect(result.matches).toBe(true);
    expect(result.hadEmbedding).toBe(false);
  });

  it("fails open when embed() returns null (endpoint down)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );
    const fakeEmbedding = serializeEmbedding([1, 0, 0]);
    const result = await semanticMatch("some claim", fakeEmbedding, cfg);
    expect(result.matches).toBe(true);
    expect(result.hadEmbedding).toBe(false);
  });

  it("returns matches: true when similarity >= threshold", async () => {
    // Claim embedding identical to section embedding → cosine = 1.0
    const vec = [0.6, 0.8];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ embedding: vec }] }),
      }),
    );
    const sectionBuf = serializeEmbedding(vec);
    const result = await semanticMatch("some claim", sectionBuf, cfg);
    expect(result.matches).toBe(true);
    expect(result.hadEmbedding).toBe(true);
    expect(result.similarity).toBeCloseTo(1.0);
  });

  it("returns matches: false when similarity < threshold", async () => {
    const claimVec = [1, 0];
    const sectionVec = [0, 1]; // orthogonal → similarity = 0
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ embedding: claimVec }] }),
      }),
    );
    const sectionBuf = serializeEmbedding(sectionVec);
    const result = await semanticMatch("unrelated claim", sectionBuf, cfg);
    expect(result.matches).toBe(false);
    expect(result.hadEmbedding).toBe(true);
    expect(result.similarity).toBeCloseTo(0);
  });
});

// ---------------------------------------------------------------------------
// embedDocumentSections
// ---------------------------------------------------------------------------

describe("embedDocumentSections", () => {
  it("is a no-op when document not found", async () => {
    const prisma = {
      document: { findUnique: vi.fn().mockResolvedValue(null) },
      documentSection: {
        findMany: vi.fn(),
        createMany: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as Parameters<typeof embedDocumentSections>[0];

    await expect(
      embedDocumentSections(prisma, "nonexistent-id"),
    ).resolves.toBeUndefined();
    expect(prisma.documentSection.findMany).not.toHaveBeenCalled();
  });

  it("skips sections that already have embeddings", async () => {
    const existingVec = serializeEmbedding([0.1, 0.2]);
    const prisma = {
      document: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: "doc1", content: "## 1\ntext" }),
      },
      documentSection: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "sec1",
            anchor: "1",
            startOffset: 0,
            endOffset: 10,
            embedding: existingVec,
          },
        ]),
        createMany: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as Parameters<typeof embedDocumentSections>[0];

    await embedDocumentSections(prisma, "doc1");
    expect(prisma.documentSection.update).not.toHaveBeenCalled();
  });

  it("stores embeddings for sections missing them", async () => {
    const vec = [0.5, 0.5];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ embedding: vec }] }),
      }),
    );

    const prisma = {
      document: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: "doc1", content: "## 1\nsome text here" }),
      },
      documentSection: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "sec1",
            anchor: "1",
            startOffset: 0,
            endOffset: 18,
            embedding: null,
          },
        ]),
        createMany: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    } as unknown as Parameters<typeof embedDocumentSections>[0];

    await embedDocumentSections(prisma, "doc1");
    expect(prisma.documentSection.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sec1" } }),
    );
  });
});
