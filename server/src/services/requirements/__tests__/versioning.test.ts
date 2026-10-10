import { describe, it, expect, beforeEach, vi } from "vitest";
import { upsertRequirementVersion } from "../versioning.js";

type Row = {
  id: string;
  reqId: string;
  text: string;
  category: string | null;
  docId: string | null;
  documentId: string | null;
  source: string;
  frameworkId: string | null;
  threatModelId: string;
  createdById: string;
  requirementFamilyId: string | null;
  version: number;
  supersededAt: Date | null;
};

function makePrisma() {
  const rows: Row[] = [];
  let idCounter = 0;
  const nextId = () => `r${++idCounter}`;

  const api = {
    requirement: {
      findFirst: vi.fn(async ({ where }) => {
        return (
          rows.find(
            (r) =>
              r.threatModelId === where.threatModelId &&
              r.reqId === where.reqId &&
              (where.supersededAt === null ? r.supersededAt === null : true),
          ) ?? null
        );
      }),
      create: vi.fn(async ({ data }) => {
        const row: Row = {
          id: nextId(),
          reqId: data.reqId,
          text: data.text,
          category: data.category ?? null,
          docId: data.docId ?? null,
          documentId: data.documentId ?? null,
          source: data.source,
          frameworkId: data.frameworkId ?? null,
          threatModelId: data.threatModelId,
          createdById: data.createdById,
          requirementFamilyId: data.requirementFamilyId ?? null,
          version: data.version ?? 1,
          supersededAt: null,
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
  threatModelId: "tm1",
  createdById: "u1",
  source: "DOCUMENT" as const,
};

describe("upsertRequirementVersion", () => {
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it("creates v1 on first insert and self-links familyId", async () => {
    const r = await upsertRequirementVersion(prisma.api as any, {
      ...BASE,
      reqId: "FR-12",
      text: "System shall authenticate users",
    });
    expect(r.outcome).toBe("created");
    expect(r.requirement.version).toBe(1);
    expect(r.requirement.requirementFamilyId).toBe(r.requirement.id);
  });

  it("returns unchanged when text identical", async () => {
    await upsertRequirementVersion(prisma.api as any, {
      ...BASE,
      reqId: "FR-12",
      text: "same text",
    });
    const second = await upsertRequirementVersion(prisma.api as any, {
      ...BASE,
      reqId: "FR-12",
      text: "same text",
    });
    expect(second.outcome).toBe("unchanged");
    expect(prisma.rows).toHaveLength(1);
  });

  it("relinks documentId on unchanged text when doc version bumped", async () => {
    await upsertRequirementVersion(prisma.api as any, {
      ...BASE,
      reqId: "FR-12",
      text: "identical",
      documentId: "docA",
    });
    const second = await upsertRequirementVersion(prisma.api as any, {
      ...BASE,
      reqId: "FR-12",
      text: "identical",
      documentId: "docB",
    });
    expect(second.outcome).toBe("unchanged");
    expect(second.requirement.documentId).toBe("docB");
  });

  it("supersedes on text change, bumps version, preserves familyId", async () => {
    const v1 = await upsertRequirementVersion(prisma.api as any, {
      ...BASE,
      reqId: "FR-12",
      text: "old text",
      documentId: "docA",
    });
    const v2 = await upsertRequirementVersion(prisma.api as any, {
      ...BASE,
      reqId: "FR-12",
      text: "new text",
      documentId: "docB",
    });
    expect(v2.outcome).toBe("superseded");
    expect(v2.requirement.version).toBe(2);
    expect(v2.requirement.requirementFamilyId).toBe(
      v1.requirement.requirementFamilyId,
    );
    expect(v2.requirement.documentId).toBe("docB");

    const prior = prisma.rows.find((r) => r.id === v1.requirement.id);
    expect(prior?.supersededAt).toBeInstanceOf(Date);
  });
});
