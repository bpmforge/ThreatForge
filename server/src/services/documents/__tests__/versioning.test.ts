import { describe, it, expect, beforeEach, vi } from "vitest";
import { hashContent, upsertDocumentVersion } from "../versioning.js";

type Row = {
  id: string;
  name: string;
  content: string;
  contentHash: string;
  documentFamilyId: string;
  version: number;
  supersededAt: Date | null;
  threatModelId: string;
  type: string;
  sizeBytes: number;
  pageCount: number | null;
  contentTruncated: boolean;
  extractionSummary: string | null;
  extractedComponentCount: number;
  extractedRequirementCount: number;
  extractedAt: Date | null;
  importedById: string;
};

function makePrisma() {
  const rows: Row[] = [];
  let idCounter = 0;
  const nextId = () => `doc${++idCounter}`;

  const api = {
    document: {
      findFirst: vi.fn(async ({ where, orderBy: _orderBy }) => {
        const matches = rows.filter(
          (r) =>
            r.threatModelId === where.threatModelId &&
            r.name === where.name &&
            (where.supersededAt === null ? r.supersededAt === null : true),
        );
        matches.sort((a, b) => b.version - a.version);
        return matches[0] ?? null;
      }),
      create: vi.fn(async ({ data }) => {
        const row: Row = {
          id: nextId(),
          name: data.name,
          content: data.content,
          contentHash: data.contentHash,
          documentFamilyId: data.documentFamilyId ?? "",
          version: data.version ?? 1,
          supersededAt: null,
          threatModelId: data.threatModelId,
          type: data.type,
          sizeBytes: data.sizeBytes,
          pageCount: data.pageCount ?? null,
          contentTruncated: data.contentTruncated,
          extractionSummary: data.extractionSummary ?? null,
          extractedComponentCount: data.extractedComponentCount ?? 0,
          extractedRequirementCount: data.extractedRequirementCount ?? 0,
          extractedAt: data.extractedAt ?? null,
          importedById: data.importedById,
        };
        rows.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = rows.find((r) => r.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return row;
      }),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return { api, rows };
}

const BASE = {
  name: "srs.pdf",
  type: "PDF" as const,
  sizeBytes: 100,
  pageCount: 2,
  contentTruncated: false,
  threatModelId: "tm1",
  importedById: "u1",
};

describe("upsertDocumentVersion", () => {
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it("creates a v1 row on first upload and sets familyId = id", async () => {
    const r = await upsertDocumentVersion(prisma.api as any, {
      ...BASE,
      content: "hello",
    });
    expect(r.outcome).toBe("created");
    expect(r.version).toBe(1);
    expect(r.document.documentFamilyId).toBe(r.document.id);
    expect(r.document.contentHash).toBe(hashContent("hello"));
    expect(r.document.supersededAt).toBeNull();
  });

  it("returns existing row with outcome=unchanged when content hash matches", async () => {
    const first = await upsertDocumentVersion(prisma.api as any, {
      ...BASE,
      content: "hello",
    });
    const second = await upsertDocumentVersion(prisma.api as any, {
      ...BASE,
      content: "hello",
    });
    expect(second.outcome).toBe("unchanged");
    expect(second.document.id).toBe(first.document.id);
    expect(prisma.rows).toHaveLength(1);
  });

  it("bumps version and supersedes previous on content change", async () => {
    const v1 = await upsertDocumentVersion(prisma.api as any, {
      ...BASE,
      content: "v1 content",
    });
    const v2 = await upsertDocumentVersion(prisma.api as any, {
      ...BASE,
      content: "v2 content",
    });
    expect(v2.outcome).toBe("superseded");
    expect(v2.version).toBe(2);
    expect(v2.document.documentFamilyId).toBe(v1.document.documentFamilyId);
    expect(v2.document.supersededAt).toBeNull();

    const prior = prisma.rows.find((r) => r.id === v1.document.id);
    expect(prior?.supersededAt).toBeInstanceOf(Date);
  });

  it("keeps separate families for different filenames", async () => {
    const a = await upsertDocumentVersion(prisma.api as any, {
      ...BASE,
      name: "srs.pdf",
      content: "A",
    });
    const b = await upsertDocumentVersion(prisma.api as any, {
      ...BASE,
      name: "sad.pdf",
      content: "B",
    });
    expect(a.document.documentFamilyId).not.toBe(b.document.documentFamilyId);
    expect(a.version).toBe(1);
    expect(b.version).toBe(1);
  });
});
