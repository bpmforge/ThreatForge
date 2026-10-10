/**
 * DOCUMENT citation verification.
 *
 * Resolves a citation against the threat model's documents, optionally a
 * named section, runs a semantic pre-check, then an LLM-as-judge cross-check.
 * Section detection is lazily persisted on first touch.
 */
import type { PrismaClient } from "@prisma/client";
import type { VerificationStatus } from "@prisma/client";
import type { AIProviderClient } from "../../types/ai.js";
import type { ParsedClaim, ParsedCitation } from "./citation-grammar.js";
import type { ClaimToVerify } from "./citation-verifier.js";
import { detectSections } from "./document-section-detector.js";
import {
  buildCrossCheckPrompt,
  parseCrossCheckResult,
} from "./prompts/cross-check.js";
import { semanticMatch, type EmbeddingConfig } from "./embedding-service.js";
import { writeCitation } from "./citation-writer.js";
import logger from "../../utils/logger.js";

export interface DocLite {
  id: string;
  name: string;
  content: string;
}

export async function verifyDocumentCitation(
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
  const doc = matchDoc(docs, citation.documentName);
  if (!doc) {
    await writeCitation(prisma, claim, {
      kind: parsed.kind,
      citationType: "DOCUMENT",
      verificationStatus: "PHANTOM",
      verifierRationale: `document "${citation.documentName}" not found in this threat model`,
      verifierProvider: providerName,
    });
    return "PHANTOM";
  }

  const sections = await ensureSections(prisma, doc);

  let sourceText: string | null = null;
  let sourceLabel = doc.name;
  let sectionDbId: string | null = null;
  let sectionEmbedding: Uint8Array | null = null;

  if (citation.sectionAnchor) {
    const section = sections.find((s) => s.anchor === citation.sectionAnchor);
    if (!section) {
      await writeCitation(prisma, claim, {
        kind: parsed.kind,
        citationType: "DOCUMENT",
        documentId: doc.id,
        verificationStatus: "PHANTOM",
        verifierRationale: `section "${citation.sectionAnchor}" not found in ${doc.name}`,
        verifierProvider: providerName,
      });
      return "PHANTOM";
    }
    sourceText = doc.content.slice(section.startOffset, section.endOffset);
    sourceLabel = `${doc.name} §${section.anchor}`;
    sectionDbId = section.id;
    sectionEmbedding = section.embedding ?? null;
  } else if (citation.pageNumber !== undefined) {
    sourceText = doc.content;
    sourceLabel = `${doc.name} p.${citation.pageNumber}`;
  } else {
    sourceText = doc.content;
  }

  // Semantic pre-check: if embeddings are available and similarity is below
  // threshold, skip the expensive LLM cross-check and mark UNVERIFIED.
  // Fails open (hadEmbedding: false) when no embedding stored.
  const semCheck = await semanticMatch(
    parsed.claim,
    sectionEmbedding,
    embeddingConfig,
  );
  if (semCheck.hadEmbedding && !semCheck.matches) {
    logger.debug(
      { similarity: semCheck.similarity, claim: parsed.claim.slice(0, 80) },
      "semantic pre-check failed — skipping LLM cross-check, marking UNVERIFIED",
    );
    await writeCitation(prisma, claim, {
      kind: parsed.kind,
      citationType: "DOCUMENT",
      documentId: doc.id,
      sectionId: sectionDbId,
      pageNumber: citation.pageNumber ?? null,
      excerpt: sourceText?.slice(0, 500) ?? null,
      verificationStatus: "UNVERIFIED",
      verifierConfidence: semCheck.similarity,
      verifierRationale: `semantic similarity ${semCheck.similarity.toFixed(3)} below threshold — claim not supported by cited section`,
      verifierProvider: "embedding",
    });
    return "UNVERIFIED";
  }

  const result = await runCrossCheck(
    aiClient,
    sourceLabel,
    sourceText,
    parsed.claim,
  );

  const status: VerificationStatus =
    result.supports && result.confidence >= threshold
      ? "VERIFIED"
      : "UNVERIFIED";

  await writeCitation(prisma, claim, {
    kind: parsed.kind,
    citationType: "DOCUMENT",
    documentId: doc.id,
    sectionId: sectionDbId,
    pageNumber: citation.pageNumber ?? null,
    excerpt: sourceText?.slice(0, 500) ?? null,
    verificationStatus: status,
    verifierConfidence: result.confidence,
    verifierRationale: result.rationale,
    verifierProvider: providerName,
  });
  return status;
}

async function runCrossCheck(
  aiClient: AIProviderClient,
  sourceLabel: string,
  sourceText: string,
  claim: string,
) {
  const prompt = buildCrossCheckPrompt({ sourceLabel, sourceText, claim });
  try {
    const response = await aiClient.complete({
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    });
    return parseCrossCheckResult(response.content, sourceText);
  } catch (err) {
    logger.warn(
      { err, sourceLabel },
      "citation cross-check provider error — marking unverified",
    );
    return {
      supports: false,
      confidence: 0,
      rationale: "verifier provider error",
      quote: "",
    };
  }
}

export async function loadDocs(
  prisma: PrismaClient,
  threatModelId: string,
): Promise<DocLite[]> {
  const rows = await prisma.document.findMany({
    where: { threatModelId, supersededAt: null },
    select: { id: true, name: true, content: true },
  });
  return rows;
}

function matchDoc(docs: DocLite[], name?: string): DocLite | undefined {
  if (!name) return undefined;
  const target = name.toLowerCase();
  return (
    docs.find((d) => d.name.toLowerCase() === target) ??
    docs.find((d) => d.name.toLowerCase().endsWith(target))
  );
}

/** Lazy-detect + persist sections for a document on first verifier touch. */
async function ensureSections(
  prisma: PrismaClient,
  doc: DocLite,
): Promise<
  {
    id: string;
    anchor: string;
    startOffset: number;
    endOffset: number;
    embedding: Uint8Array | null;
  }[]
> {
  const select = {
    id: true,
    anchor: true,
    startOffset: true,
    endOffset: true,
    embedding: true,
  } as const;

  const existing = await prisma.documentSection.findMany({
    where: { documentId: doc.id },
    select,
  });
  if (existing.length > 0) return existing;

  const detected = detectSections(doc.content);
  if (detected.length === 0) return [];

  await prisma.documentSection.createMany({
    data: detected.map((s) => ({
      documentId: doc.id,
      anchor: s.anchor,
      header: s.header,
      pageNumber: s.pageNumber ?? null,
      startOffset: s.startOffset,
      endOffset: s.endOffset,
    })),
  });

  return prisma.documentSection.findMany({
    where: { documentId: doc.id },
    select,
  });
}
