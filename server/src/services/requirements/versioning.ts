/**
 * Requirement versioning — mirrors Document versioning.
 *
 * When requirements arrive from a document (e.g. re-extraction after uploading
 * a new version of the same SAD.pdf), we compare text against the current
 * version in the same (threatModelId, reqId) family:
 *   - text identical → no-op (optionally relink documentId if it changed)
 *   - text differs   → new Requirement row with bumped version, old row supersededAt
 *   - new reqId      → v1 row, familyId set to own id
 *
 * Callers that don't care about versioning (MANUAL / CSV / FRAMEWORK) can still
 * use bulk insert — the versioning path only triggers when text differs.
 */
import type { PrismaClient, Requirement } from "@prisma/client";
import type { RequirementSource } from "@prisma/client";

export interface UpsertRequirementInput {
  reqId: string;
  text: string;
  category?: string | null;
  docId?: string | null;
  documentId?: string | null;
  source: RequirementSource;
  frameworkId?: string | null;
  threatModelId: string;
  createdById: string;
}

export interface UpsertRequirementResult {
  requirement: Requirement;
  outcome: "created" | "superseded" | "unchanged";
}

export async function upsertRequirementVersion(
  prisma: PrismaClient,
  input: UpsertRequirementInput,
): Promise<UpsertRequirementResult> {
  const current = await prisma.requirement.findFirst({
    where: {
      threatModelId: input.threatModelId,
      reqId: input.reqId,
      supersededAt: null,
    },
    orderBy: { version: "desc" },
  });

  if (!current) {
    const created = await prisma.requirement.create({
      data: {
        reqId: input.reqId,
        text: input.text,
        category: input.category ?? null,
        docId: input.docId ?? null,
        documentId: input.documentId ?? null,
        source: input.source,
        frameworkId: input.frameworkId ?? null,
        threatModelId: input.threatModelId,
        createdById: input.createdById,
        version: 1,
      },
    });
    const linked = await prisma.requirement.update({
      where: { id: created.id },
      data: { requirementFamilyId: created.id },
    });
    return { requirement: linked, outcome: "created" };
  }

  if (current.text === input.text) {
    // Text unchanged — relink documentId if it moved to a newer doc version.
    if (input.documentId && input.documentId !== current.documentId) {
      const relinked = await prisma.requirement.update({
        where: { id: current.id },
        data: { documentId: input.documentId },
      });
      return { requirement: relinked, outcome: "unchanged" };
    }
    return { requirement: current, outcome: "unchanged" };
  }

  const familyId = current.requirementFamilyId ?? current.id;
  const nextVersion = current.version + 1;
  const [, next] = await prisma.$transaction([
    prisma.requirement.update({
      where: { id: current.id },
      data: { supersededAt: new Date() },
    }),
    prisma.requirement.create({
      data: {
        reqId: input.reqId,
        text: input.text,
        category: input.category ?? null,
        docId: input.docId ?? null,
        documentId: input.documentId ?? null,
        source: input.source,
        frameworkId: input.frameworkId ?? null,
        threatModelId: input.threatModelId,
        createdById: input.createdById,
        requirementFamilyId: familyId,
        version: nextVersion,
      },
    }),
  ]);

  return { requirement: next, outcome: "superseded" };
}
