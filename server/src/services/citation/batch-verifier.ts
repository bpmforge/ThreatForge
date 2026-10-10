/**
 * Batch Citation Verifier.
 *
 * Fetches all PENDING DOCUMENT citations for a threat model, runs the
 * cross-check on each one (reusing existing prompts/logic), updates each
 * citation row in-place, then recomputes owner rollups. Does NOT create
 * new citation rows — only updates existing PENDING ones.
 */
import type { PrismaClient } from "@prisma/client";
import type { AIProviderClient } from "../../types/ai.js";
import {
  semanticMatch,
  defaultEmbeddingConfig,
  type EmbeddingConfig,
} from "./embedding-service.js";
import {
  buildCrossCheckPrompt,
  parseCrossCheckResult,
} from "./prompts/cross-check.js";
import { computeRollup } from "./citation-verifier.js";
import logger from "../../utils/logger.js";

export interface BatchVerifySummary {
  total: number;
  verified: number;
  unverified: number;
  phantom: number;
  /** Non-DOCUMENT, already resolved, or no claim text / section available. */
  skipped: number;
}

const DEFAULT_THRESHOLD = 0.7;

export async function batchVerifyCitations(
  prisma: PrismaClient,
  aiClient: AIProviderClient,
  threatModelId: string,
  opts: {
    providerName?: string;
    embeddingConfig?: EmbeddingConfig;
    confidenceThreshold?: number;
  } = {},
): Promise<BatchVerifySummary> {
  const threshold = opts.confidenceThreshold ?? DEFAULT_THRESHOLD;
  const providerName = opts.providerName ?? "unknown";
  const embeddingConfig = opts.embeddingConfig ?? defaultEmbeddingConfig();

  const summary: BatchVerifySummary = {
    total: 0,
    verified: 0,
    unverified: 0,
    phantom: 0,
    skipped: 0,
  };

  // Fetch PENDING DOCUMENT citations on threats
  const threatCitations = await prisma.citation.findMany({
    where: {
      citationType: "DOCUMENT",
      verificationStatus: "PENDING",
      threat: { threatModelId },
    },
    select: {
      id: true,
      documentId: true,
      sectionId: true,
      kind: true,
      threat: { select: { id: true, name: true, description: true } },
      section: {
        select: {
          anchor: true,
          startOffset: true,
          endOffset: true,
          embedding: true,
        },
      },
      document: { select: { id: true, name: true, content: true } },
    },
  });

  // Fetch PENDING DOCUMENT citations on mitigations
  const mitigationCitations = await prisma.citation.findMany({
    where: {
      citationType: "DOCUMENT",
      verificationStatus: "PENDING",
      mitigation: { threat: { threatModelId } },
    },
    select: {
      id: true,
      documentId: true,
      sectionId: true,
      kind: true,
      mitigation: {
        select: { id: true, description: true, threatId: true },
      },
      section: {
        select: {
          anchor: true,
          startOffset: true,
          endOffset: true,
          embedding: true,
        },
      },
      document: { select: { id: true, name: true, content: true } },
    },
  });

  summary.total = threatCitations.length + mitigationCitations.length;

  // Track owners that need rollup recomputation
  const threatIdsToRollup = new Set<string>();
  const mitigationIdsToRollup = new Set<string>();

  // Process threat citations
  for (const citation of threatCitations) {
    const doc = citation.document;
    const section = citation.section;
    const threat = citation.threat;

    if (!doc || !section || !threat) {
      logger.debug(
        { citationId: citation.id },
        "batch-verify: skipping citation — missing doc/section/threat",
      );
      summary.skipped++;
      continue;
    }

    const claimText = [threat.name, threat.description]
      .filter(Boolean)
      .join(" — ");

    try {
      const status = await verifyCitation(
        aiClient,
        claimText,
        doc,
        section,
        threshold,
        embeddingConfig,
      );

      await prisma.citation.update({
        where: { id: citation.id },
        data: {
          verificationStatus: status.verificationStatus,
          verifiedAt: new Date(),
          verifierConfidence: status.confidence,
          verifierRationale: status.rationale,
          verifierProvider: providerName,
        },
      });

      summary[bucketFor(status.verificationStatus)]++;
      threatIdsToRollup.add(threat.id);
    } catch (err) {
      logger.error(
        { err, citationId: citation.id },
        "batch-verify: error processing threat citation — skipping",
      );
      summary.skipped++;
    }
  }

  // Process mitigation citations
  for (const citation of mitigationCitations) {
    const doc = citation.document;
    const section = citation.section;
    const mitigation = citation.mitigation;

    if (!doc || !section || !mitigation) {
      logger.debug(
        { citationId: citation.id },
        "batch-verify: skipping citation — missing doc/section/mitigation",
      );
      summary.skipped++;
      continue;
    }

    const claimText = mitigation.description ?? "";

    try {
      const status = await verifyCitation(
        aiClient,
        claimText,
        doc,
        section,
        threshold,
        embeddingConfig,
      );

      await prisma.citation.update({
        where: { id: citation.id },
        data: {
          verificationStatus: status.verificationStatus,
          verifiedAt: new Date(),
          verifierConfidence: status.confidence,
          verifierRationale: status.rationale,
          verifierProvider: providerName,
        },
      });

      summary[bucketFor(status.verificationStatus)]++;
      mitigationIdsToRollup.add(mitigation.id);
    } catch (err) {
      logger.error(
        { err, citationId: citation.id },
        "batch-verify: error processing mitigation citation — skipping",
      );
      summary.skipped++;
    }
  }

  // Recompute rollups for all affected threats
  for (const threatId of threatIdsToRollup) {
    try {
      const allCitations = await prisma.citation.findMany({
        where: { threatId },
        select: { verificationStatus: true },
      });
      const rollup = computeRollup(
        allCitations.map((c) => c.verificationStatus),
      );
      await prisma.threat.update({
        where: { id: threatId },
        data: { verificationStatus: rollup },
      });
    } catch (err) {
      logger.warn(
        { err, threatId },
        "batch-verify: failed to recompute threat rollup",
      );
    }
  }

  // Recompute rollups for all affected mitigations
  for (const mitigationId of mitigationIdsToRollup) {
    try {
      const allCitations = await prisma.citation.findMany({
        where: { mitigationId },
        select: { verificationStatus: true },
      });
      const rollup = computeRollup(
        allCitations.map((c) => c.verificationStatus),
      );
      await prisma.mitigation.update({
        where: { id: mitigationId },
        data: { verificationStatus: rollup },
      });
    } catch (err) {
      logger.warn(
        { err, mitigationId },
        "batch-verify: failed to recompute mitigation rollup",
      );
    }
  }

  logger.info(
    { threatModelId, ...summary },
    "batch citation verification complete",
  );

  return summary;
}

interface VerifyResult {
  verificationStatus: "VERIFIED" | "UNVERIFIED";
  confidence: number;
  rationale: string;
}

async function verifyCitation(
  aiClient: AIProviderClient,
  claimText: string,
  doc: { id: string; name: string; content: string },
  section: {
    anchor: string;
    startOffset: number;
    endOffset: number;
    embedding: Uint8Array | Buffer | null;
  },
  threshold: number,
  embeddingConfig: EmbeddingConfig,
): Promise<VerifyResult> {
  // Prisma Bytes fields are returned as Uint8Array; Buffer is a subclass in
  // Node.js so the cast is safe at runtime — both share the same memory layout.
  const embedding = section.embedding
    ? (Buffer.from(section.embedding) as Buffer)
    : null;

  // Semantic pre-check — skip expensive LLM call if similarity is below threshold
  const semCheck = await semanticMatch(claimText, embedding, embeddingConfig);
  if (semCheck.hadEmbedding && !semCheck.matches) {
    logger.debug(
      { similarity: semCheck.similarity, claim: claimText.slice(0, 80) },
      "batch-verify: semantic pre-check failed — marking UNVERIFIED",
    );
    return {
      verificationStatus: "UNVERIFIED",
      confidence: semCheck.similarity,
      rationale: `semantic similarity ${semCheck.similarity.toFixed(3)} below threshold — claim not supported by cited section`,
    };
  }

  const sourceText = doc.content.slice(section.startOffset, section.endOffset);
  const sourceLabel = `${doc.name} §${section.anchor}`;
  const prompt = buildCrossCheckPrompt({
    sourceLabel,
    sourceText,
    claim: claimText,
  });

  const response = await aiClient.complete({
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  const result = parseCrossCheckResult(response.content, sourceText);
  const verificationStatus =
    result.supports && result.confidence >= threshold
      ? "VERIFIED"
      : "UNVERIFIED";

  return {
    verificationStatus,
    confidence: result.confidence,
    rationale: result.rationale,
  };
}

function bucketFor(
  status: "VERIFIED" | "UNVERIFIED",
): "verified" | "unverified" {
  return status === "VERIFIED" ? "verified" : "unverified";
}
