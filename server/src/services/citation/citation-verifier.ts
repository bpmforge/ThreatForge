/**
 * Citation verifier.
 *
 * Takes parsed claims with their owners (Threat or Mitigation), resolves
 * each citation against the threat model's documents, runs an LLM-as-judge
 * cross-check for DOCUMENT citations, persists Citation rows, and updates
 * the rollup verificationStatus on the owner.
 *
 * REFERENCE citations resolve against the curated reference set, REQUIREMENT
 * against the model's requirements, and COMPONENT against its canvas.
 *
 * This module is the orchestrator. Per-citation-type verification lives in
 * citation-verifier-document.ts and citation-verifier-resources.ts; the
 * persistence + rollup math lives in citation-writer.ts.
 */
import type { PrismaClient } from "@prisma/client";
import type { VerificationStatus } from "@prisma/client";
import type { AIProviderClient } from "../../types/ai.js";
import type { ParsedClaim, ParsedCitation } from "./citation-grammar.js";
import {
  defaultEmbeddingConfig,
  type EmbeddingConfig,
} from "./embedding-service.js";
import {
  bucketFor,
  degrade,
  updateOwnerRollup,
  writeCitation,
} from "./citation-writer.js";
import {
  verifyDocumentCitation,
  loadDocs,
  type DocLite,
} from "./citation-verifier-document.js";
import {
  verifyReferenceCitation,
  verifyRequirementCitation,
  verifyComponentCitation,
} from "./citation-verifier-resources.js";

export { computeRollup } from "./citation-writer.js";

export interface ClaimToVerify {
  ownerType: "threat" | "mitigation";
  ownerId: string;
  parsed: ParsedClaim;
}

export interface VerifyOptions {
  /** Minimum cross-check confidence to count as VERIFIED. Default 0.7. */
  confidenceThreshold?: number;
  /** Provider name string to record on each Citation row. */
  providerName?: string;
  /** Embedding config for semantic pre-check. Defaults to env-var config. */
  embeddingConfig?: EmbeddingConfig;
}

export interface VerifySummary {
  total: number;
  verified: number;
  unverified: number;
  phantom: number;
  pending: number;
}

const DEFAULT_THRESHOLD = 0.7;

export async function verifyClaims(
  prisma: PrismaClient,
  aiClient: AIProviderClient,
  threatModelId: string,
  claims: ClaimToVerify[],
  opts: VerifyOptions = {},
): Promise<VerifySummary> {
  const threshold = opts.confidenceThreshold ?? DEFAULT_THRESHOLD;
  const providerName = opts.providerName ?? "unknown";
  const embeddingConfig = opts.embeddingConfig ?? defaultEmbeddingConfig();

  const docs = await loadDocs(prisma, threatModelId);
  const summary: VerifySummary = {
    total: claims.length,
    verified: 0,
    unverified: 0,
    phantom: 0,
    pending: 0,
  };

  for (const claim of claims) {
    const status = await verifyOneClaim(
      prisma,
      aiClient,
      claim,
      docs,
      threshold,
      providerName,
      embeddingConfig,
    );
    summary[bucketFor(status)]++;
    await updateOwnerRollup(prisma, claim, status);
  }

  return summary;
}

async function verifyOneClaim(
  prisma: PrismaClient,
  aiClient: AIProviderClient,
  claim: ClaimToVerify,
  docs: DocLite[],
  threshold: number,
  providerName: string,
  embeddingConfig: EmbeddingConfig,
): Promise<VerificationStatus> {
  const { parsed } = claim;

  // NOT_FOUND must be checked before the empty-citations guard — these
  // claims have kind=NOT_FOUND but carry no citations by design.
  if (parsed.kind === "NOT_FOUND") {
    await writeCitation(prisma, claim, {
      kind: "NOT_FOUND",
      citationType: "NONE",
      verificationStatus: "EXEMPT",
      verifierRationale: "LLM flagged as not found in source",
      verifierProvider: providerName,
    });
    return "EXEMPT";
  }

  if (parsed.kind === "NONE" || parsed.citations.length === 0) {
    await writeCitation(prisma, claim, {
      kind: "NONE",
      citationType: "NONE",
      verificationStatus: "UNVERIFIED",
      verifierRationale: "no citation provided",
      verifierProvider: providerName,
    });
    return "UNVERIFIED";
  }

  // Verify each citation; rollup is the worst result across them
  let worst: VerificationStatus = "VERIFIED";
  for (const citation of parsed.citations) {
    const status = await verifyCitation(
      prisma,
      aiClient,
      claim,
      parsed,
      citation,
      docs,
      threshold,
      providerName,
      embeddingConfig,
    );
    worst = degrade(worst, status);
  }
  return worst;
}

async function verifyCitation(
  prisma: PrismaClient,
  aiClient: AIProviderClient,
  claim: ClaimToVerify,
  parsed: ParsedClaim,
  citation: ParsedCitation,
  docs: DocLite[],
  threshold: number,
  providerName: string,
  embeddingConfig: EmbeddingConfig,
): Promise<VerificationStatus> {
  if (citation.type === "DOCUMENT") {
    return verifyDocumentCitation(
      prisma,
      aiClient,
      claim,
      parsed,
      citation,
      docs,
      threshold,
      providerName,
      embeddingConfig,
    );
  }

  if (citation.type === "REFERENCE") {
    return verifyReferenceCitation(
      prisma,
      claim,
      parsed,
      citation,
      providerName,
    );
  }

  if (citation.type === "REQUIREMENT") {
    return verifyRequirementCitation(
      prisma,
      claim,
      parsed,
      citation,
      providerName,
    );
  }

  // COMPONENT — resolve nodeId against current canvas state for the model
  return verifyComponentCitation(prisma, claim, parsed, citation, providerName);
}
