/**
 * Non-document citation verification: REFERENCE, REQUIREMENT, and COMPONENT.
 *
 * REFERENCE resolves against the curated reference set; REQUIREMENT resolves
 * against Requirement rows scoped to the owning threat model; COMPONENT
 * resolves a nodeId (or DB id) against the model's current canvas components.
 */
import type { PrismaClient } from "@prisma/client";
import type { VerificationStatus } from "@prisma/client";
import type { ParsedClaim, ParsedCitation } from "./citation-grammar.js";
import type { ClaimToVerify } from "./citation-verifier.js";
import { checkReference } from "./reference-resolver.js";
import { writeCitation } from "./citation-writer.js";

export async function verifyReferenceCitation(
  prisma: PrismaClient,
  claim: ClaimToVerify,
  parsed: ParsedClaim,
  citation: ParsedCitation,
  providerName: string,
): Promise<VerificationStatus> {
  const check = checkReference(citation.referenceKind, citation.referenceId);
  const status: VerificationStatus = check.resolved ? "VERIFIED" : "PHANTOM";
  await writeCitation(prisma, claim, {
    kind: parsed.kind,
    citationType: "REFERENCE",
    referenceKind: citation.referenceKind ?? null,
    referenceId: citation.referenceId ?? null,
    verificationStatus: status,
    verifierConfidence: check.inCuratedSet ? 1.0 : check.resolved ? 0.6 : 0,
    verifierRationale: check.rationale,
    verifierProvider: providerName,
  });
  return status;
}

export async function verifyComponentCitation(
  prisma: PrismaClient,
  claim: ClaimToVerify,
  parsed: ParsedClaim,
  citation: ParsedCitation,
  providerName: string,
): Promise<VerificationStatus> {
  if (!citation.componentNodeId) {
    await writeCitation(prisma, claim, {
      kind: parsed.kind,
      citationType: "COMPONENT",
      verificationStatus: "PHANTOM",
      verifierRationale: "no component id supplied",
      verifierProvider: providerName,
    });
    return "PHANTOM";
  }

  const knownNodes = await loadComponentNodeIds(prisma, claim);
  const exists = knownNodes.has(citation.componentNodeId);
  const status: VerificationStatus = exists ? "VERIFIED" : "PHANTOM";
  await writeCitation(prisma, claim, {
    kind: parsed.kind,
    citationType: "COMPONENT",
    componentNodeId: citation.componentNodeId,
    verificationStatus: status,
    verifierConfidence: exists ? 1.0 : 0,
    verifierRationale: exists
      ? "component nodeId resolved on current canvas"
      : `component nodeId "${citation.componentNodeId}" not found on canvas`,
    verifierProvider: providerName,
  });
  return status;
}

/**
 * REQUIREMENT citation — resolve reqId against Requirement rows scoped to
 * the threatModelId that owns this claim. Writes a Citation row with the
 * FK (requirementId) when resolved; PHANTOM when the reqId does not exist.
 * Cheap: one DB read per distinct reqId per claim, cached via the lookup.
 */
export async function verifyRequirementCitation(
  prisma: PrismaClient,
  claim: ClaimToVerify,
  parsed: ParsedClaim,
  citation: ParsedCitation,
  providerName: string,
): Promise<VerificationStatus> {
  if (!citation.requirementId) {
    await writeCitation(prisma, claim, {
      kind: parsed.kind,
      citationType: "REQUIREMENT",
      verificationStatus: "PHANTOM",
      verifierRationale: "no requirement id supplied",
      verifierProvider: providerName,
    });
    return "PHANTOM";
  }

  const threatModelId = await resolveThreatModelId(prisma, claim);
  if (!threatModelId) {
    await writeCitation(prisma, claim, {
      kind: parsed.kind,
      citationType: "REQUIREMENT",
      verificationStatus: "PHANTOM",
      verifierRationale: "owner's threat model could not be resolved",
      verifierProvider: providerName,
    });
    return "PHANTOM";
  }

  const req = await prisma.requirement.findFirst({
    where: {
      threatModelId,
      reqId: citation.requirementId,
      supersededAt: null,
    },
    orderBy: { version: "desc" },
    select: { id: true },
  });

  const status: VerificationStatus = req ? "VERIFIED" : "PHANTOM";
  await writeCitation(prisma, claim, {
    kind: parsed.kind,
    citationType: "REQUIREMENT",
    requirementId: req?.id ?? null,
    verificationStatus: status,
    verifierConfidence: req ? 1.0 : 0,
    verifierRationale: req
      ? `requirement ${citation.requirementId} resolved in this threat model`
      : `requirement "${citation.requirementId}" not found in this threat model`,
    verifierProvider: providerName,
  });
  return status;
}

async function resolveThreatModelId(
  prisma: PrismaClient,
  claim: ClaimToVerify,
): Promise<string | null> {
  if (claim.ownerType === "threat") {
    const t = await prisma.threat.findUnique({
      where: { id: claim.ownerId },
      select: { threatModelId: true },
    });
    return t?.threatModelId ?? null;
  }
  const m = await prisma.mitigation.findUnique({
    where: { id: claim.ownerId },
    select: { threat: { select: { threatModelId: true } } },
  });
  return m?.threat?.threatModelId ?? null;
}

/**
 * Look up the set of canvas node ids for the threat model that owns this
 * claim. Cached per-process via the cache below to avoid hitting Prisma
 * once per citation in a batch.
 *
 * The threatModelId isn't on the claim directly; we resolve it through
 * the threat or mitigation owner.
 */
const componentNodeCache = new WeakMap<
  PrismaClient,
  Map<string, Set<string>>
>();
async function loadComponentNodeIds(
  prisma: PrismaClient,
  claim: ClaimToVerify,
): Promise<Set<string>> {
  let perPrisma = componentNodeCache.get(prisma);
  if (!perPrisma) {
    perPrisma = new Map();
    componentNodeCache.set(prisma, perPrisma);
  }
  const ownerKey = `${claim.ownerType}:${claim.ownerId}`;
  const cached = perPrisma.get(ownerKey);
  if (cached) return cached;

  let threatModelId: string | null = null;
  if (claim.ownerType === "threat") {
    const t = await prisma.threat.findUnique({
      where: { id: claim.ownerId },
      select: { threatModelId: true },
    });
    threatModelId = t?.threatModelId ?? null;
  } else {
    const m = await prisma.mitigation.findUnique({
      where: { id: claim.ownerId },
      select: { threat: { select: { threatModelId: true } } },
    });
    threatModelId = m?.threat?.threatModelId ?? null;
  }

  if (!threatModelId) {
    perPrisma.set(ownerKey, new Set());
    return perPrisma.get(ownerKey)!;
  }

  const components = await prisma.component.findMany({
    where: { threatModelId },
    select: { id: true, nodeId: true },
  });
  // Accept either the React Flow nodeId OR the Prisma DB id. The LLM
  // prompt passes DB ids to the model (buildThreatAnalysisPrompt), so
  // citations of that form resolve against the same component row.
  const ids = new Set<string>();
  for (const c of components) {
    if (c.id) ids.add(c.id);
    if (c.nodeId) ids.add(c.nodeId);
  }
  perPrisma.set(ownerKey, ids);
  return ids;
}
