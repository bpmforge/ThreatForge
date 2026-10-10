/**
 * Citation persistence + rollup helpers.
 *
 * Leaf module shared by the citation verifier orchestrator and its per-type
 * verifier modules. Holds the Citation row shape, the write path, and the
 * owner rollup/degradation math. No imports from sibling verifier modules —
 * keep this a leaf to avoid circular imports.
 */
import type { PrismaClient } from "@prisma/client";
import type { CitationKind, VerificationStatus } from "@prisma/client";
import type { ClaimToVerify, VerifySummary } from "./citation-verifier.js";
import logger from "../../utils/logger.js";

export interface CitationRow {
  kind: CitationKind;
  citationType: "DOCUMENT" | "REFERENCE" | "COMPONENT" | "REQUIREMENT" | "NONE";
  documentId?: string | null;
  sectionId?: string | null;
  pageNumber?: number | null;
  excerpt?: string | null;
  referenceKind?: string | null;
  referenceId?: string | null;
  componentNodeId?: string | null;
  requirementId?: string | null;
  verificationStatus: VerificationStatus;
  verifierConfidence?: number | null;
  verifierRationale?: string | null;
  verifierProvider?: string | null;
}

export async function writeCitation(
  prisma: PrismaClient,
  claim: ClaimToVerify,
  row: CitationRow,
): Promise<void> {
  // XOR enforcement — exactly one owner field set
  const ownerFields =
    claim.ownerType === "threat"
      ? { threatId: claim.ownerId }
      : { mitigationId: claim.ownerId };

  await prisma.citation.create({
    data: {
      ...row,
      ...ownerFields,
      verifiedAt: row.verificationStatus === "PENDING" ? null : new Date(),
    },
  });
}

export async function updateOwnerRollup(
  prisma: PrismaClient,
  claim: ClaimToVerify,
  newClaimStatus: VerificationStatus,
): Promise<void> {
  // Rollup semantics:
  //   ANY citation UNVERIFIED or PHANTOM → UNVERIFIED
  //   ALL non-NONE citations VERIFIED   → VERIFIED
  //   anything else                     → PENDING
  const where =
    claim.ownerType === "threat"
      ? { threatId: claim.ownerId }
      : { mitigationId: claim.ownerId };
  const allCitations = await prisma.citation.findMany({
    where,
    select: { verificationStatus: true },
  });

  const rollup = computeRollup(allCitations.map((c) => c.verificationStatus));

  if (claim.ownerType === "threat") {
    await prisma.threat.update({
      where: { id: claim.ownerId },
      data: { verificationStatus: rollup },
    });
  } else {
    await prisma.mitigation.update({
      where: { id: claim.ownerId },
      data: { verificationStatus: rollup },
    });
  }
  // Reference newClaimStatus to satisfy the type-checker on a debug log
  logger.debug(
    {
      ownerType: claim.ownerType,
      ownerId: claim.ownerId,
      newClaimStatus,
      rollup,
    },
    "citation rollup updated",
  );
}

export function computeRollup(
  statuses: VerificationStatus[],
): VerificationStatus {
  if (statuses.length === 0) return "PENDING";
  if (statuses.some((s) => s === "UNVERIFIED" || s === "PHANTOM")) {
    return "UNVERIFIED";
  }
  if (statuses.every((s) => s === "VERIFIED" || s === "EXEMPT")) {
    return "VERIFIED";
  }
  return "PENDING";
}

export function bucketFor(s: VerificationStatus): keyof VerifySummary {
  if (s === "VERIFIED") return "verified";
  if (s === "PHANTOM") return "phantom";
  if (s === "UNVERIFIED") return "unverified";
  return "pending";
}

/** Severity ordering for rollup degradation across citations of one claim. */
export function degrade(
  current: VerificationStatus,
  next: VerificationStatus,
): VerificationStatus {
  const rank: Record<VerificationStatus, number> = {
    PHANTOM: 4,
    UNVERIFIED: 3,
    PENDING: 2,
    EXEMPT: 1,
    VERIFIED: 0,
  };
  return rank[next] > rank[current] ? next : current;
}
