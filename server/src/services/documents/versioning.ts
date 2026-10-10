/**
 * Document versioning — immutable-row strategy.
 *
 * Re-uploading a document with the same name under a threat model:
 *   - identical content (contentHash match) → return the existing current row, no new version.
 *   - different content → create a new Document row in the same family, bump version,
 *     stamp the previous row's supersededAt.
 *
 * First-time upload: documentFamilyId = id, version = 1.
 *
 * Citations keep pointing at the specific Document row they were verified against,
 * so upgrading a document never silently invalidates existing findings.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

export interface DocumentUploadInput {
  name: string;
  type: Prisma.DocumentCreateInput["type"];
  content: string;
  sizeBytes: number;
  pageCount?: number | null;
  contentTruncated: boolean;
  extractionSummary?: string | null;
  extractedComponentCount?: number;
  extractedRequirementCount?: number;
  threatModelId: string;
  importedById: string;
}

export interface UpsertResult {
  document: Awaited<ReturnType<PrismaClient["document"]["create"]>>;
  /** "created" = first version, "superseded" = new version of an existing family, "unchanged" = hash match. */
  outcome: "created" | "superseded" | "unchanged";
  /** The version number of the returned row. */
  version: number;
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Upsert a document by (threatModelId, name). Callers must have already
 * validated access to the threat model.
 */
export async function upsertDocumentVersion(
  prisma: PrismaClient,
  input: DocumentUploadInput,
): Promise<UpsertResult> {
  const contentHash = hashContent(input.content);

  const current = await prisma.document.findFirst({
    where: {
      threatModelId: input.threatModelId,
      name: input.name,
      supersededAt: null,
    },
    orderBy: { version: "desc" },
  });

  if (current && current.contentHash === contentHash) {
    return {
      document: current,
      outcome: "unchanged",
      version: current.version,
    };
  }

  if (!current) {
    const created = await prisma.document.create({
      data: {
        name: input.name,
        type: input.type,
        content: input.content,
        contentHash,
        contentTruncated: input.contentTruncated,
        sizeBytes: input.sizeBytes,
        pageCount: input.pageCount ?? null,
        extractedAt: new Date(),
        extractionSummary: input.extractionSummary ?? null,
        extractedComponentCount: input.extractedComponentCount ?? 0,
        extractedRequirementCount: input.extractedRequirementCount ?? 0,
        threatModelId: input.threatModelId,
        importedById: input.importedById,
        documentFamilyId: "",
        version: 1,
      },
    });
    const linked = await prisma.document.update({
      where: { id: created.id },
      data: { documentFamilyId: created.id },
    });
    return { document: linked, outcome: "created", version: 1 };
  }

  const nextVersion = current.version + 1;
  const [_superseded, next] = await prisma.$transaction([
    prisma.document.update({
      where: { id: current.id },
      data: { supersededAt: new Date() },
    }),
    prisma.document.create({
      data: {
        name: input.name,
        type: input.type,
        content: input.content,
        contentHash,
        contentTruncated: input.contentTruncated,
        sizeBytes: input.sizeBytes,
        pageCount: input.pageCount ?? null,
        extractedAt: new Date(),
        extractionSummary: input.extractionSummary ?? null,
        extractedComponentCount: input.extractedComponentCount ?? 0,
        extractedRequirementCount: input.extractedRequirementCount ?? 0,
        threatModelId: input.threatModelId,
        importedById: input.importedById,
        documentFamilyId: current.documentFamilyId || current.id,
        version: nextVersion,
      },
    }),
  ]);

  return { document: next, outcome: "superseded", version: nextVersion };
}
