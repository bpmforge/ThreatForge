/**
 * Embedding Service
 *
 * Generates vector embeddings for document sections and computes cosine
 * similarity for semantic citation verification.
 *
 * Backed by any OpenAI-compatible /embeddings endpoint:
 *   - LM Studio (default, local): AI_EMBEDDING_BASE_URL + AI_EMBEDDING_MODEL
 *   - OpenAI, Azure, any compatible cloud: set the same env vars
 *
 * On SQLite (dev) or when the endpoint is unreachable, all methods fail open —
 * callers receive null embeddings and the semantic pre-check is skipped,
 * falling through to the LLM-as-judge cross-check as before.
 */
import type { PrismaClient } from "@prisma/client";
import { detectSections } from "./document-section-detector.js";
import logger from "../../utils/logger.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface EmbeddingConfig {
  baseUrl: string;
  model: string;
  /** Max chars of section text sent for embedding. Default 2000. */
  maxChars?: number;
  /** Cosine similarity threshold below which the semantic check fails. Default 0.6. */
  threshold?: number;
}

export function defaultEmbeddingConfig(): EmbeddingConfig {
  return {
    baseUrl: process.env.AI_EMBEDDING_BASE_URL ?? "http://localhost:1234/v1",
    model: process.env.AI_EMBEDDING_MODEL ?? "nomic-embed-text",
    maxChars: Number(process.env.AI_EMBEDDING_MAX_CHARS ?? 2000),
    threshold: Number(process.env.AI_EMBEDDING_THRESHOLD ?? 0.6),
  };
}

// ---------------------------------------------------------------------------
// Core math
// ---------------------------------------------------------------------------

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Serialisation (Float32Array ↔ Buffer, 4 bytes per dimension)
// ---------------------------------------------------------------------------

export function serializeEmbedding(v: number[]): Uint8Array<ArrayBuffer> {
  const ab = new ArrayBuffer(v.length * 4);
  const f32 = new Float32Array(ab);
  for (let i = 0; i < v.length; i++) f32[i] = v[i];
  return new Uint8Array(ab);
}

export function deserializeEmbedding(b: Uint8Array): number[] {
  const f32 = new Float32Array(b.buffer, b.byteOffset, b.length / 4);
  return Array.from(f32);
}

// ---------------------------------------------------------------------------
// HTTP client (OpenAI-compatible /embeddings)
// ---------------------------------------------------------------------------

interface EmbeddingResponse {
  data: { embedding: number[] }[];
}

async function embed(
  text: string,
  config: EmbeddingConfig,
): Promise<number[] | null> {
  const input = text.slice(0, config.maxChars ?? 2000);
  try {
    const res = await fetch(`${config.baseUrl}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.model, input }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ status: res.status, body }, "embedding request failed");
      return null;
    }
    const json = (await res.json()) as EmbeddingResponse;
    return json.data?.[0]?.embedding ?? null;
  } catch (err) {
    logger.warn({ err }, "embedding fetch error — fail open");
    return null;
  }
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

/**
 * Detect sections for a document, store them if missing, then embed each
 * section text and persist the embedding bytes. Idempotent — sections with
 * an existing embedding are skipped.
 *
 * This is a best-effort background job. Any failure is logged and swallowed
 * so document import is never blocked by embedding availability.
 */
export async function embedDocumentSections(
  prisma: PrismaClient,
  documentId: string,
  config?: EmbeddingConfig,
): Promise<void> {
  const cfg = config ?? defaultEmbeddingConfig();

  try {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, content: true },
    });
    if (!doc) return;

    // Ensure sections exist (reuses citation-verifier lazy logic)
    let sections = await prisma.documentSection.findMany({
      where: { documentId },
      select: {
        id: true,
        anchor: true,
        startOffset: true,
        endOffset: true,
        embedding: true,
      },
    });

    if (sections.length === 0) {
      const detected = detectSections(doc.content);
      if (detected.length === 0) {
        logger.debug(
          { documentId },
          "no sections detected — skipping embedding",
        );
        return;
      }
      await prisma.documentSection.createMany({
        data: detected.map((s) => ({
          documentId,
          anchor: s.anchor,
          header: s.header,
          pageNumber: s.pageNumber ?? null,
          startOffset: s.startOffset,
          endOffset: s.endOffset,
        })),
      });
      sections = await prisma.documentSection.findMany({
        where: { documentId },
        select: {
          id: true,
          anchor: true,
          startOffset: true,
          endOffset: true,
          embedding: true,
        },
      });
    }

    // Embed only sections that don't yet have an embedding
    const pending = sections.filter((s) => s.embedding === null);
    if (pending.length === 0) return;

    let embedded = 0;
    for (const section of pending) {
      const text = doc.content.slice(section.startOffset, section.endOffset);
      const vector = await embed(text, cfg);
      if (!vector) continue;
      await prisma.documentSection.update({
        where: { id: section.id },
        data: { embedding: serializeEmbedding(vector) },
      });
      embedded++;
    }

    logger.info(
      { documentId, total: pending.length, embedded },
      "document section embeddings generated",
    );
  } catch (err) {
    logger.warn(
      { err, documentId },
      "embedDocumentSections failed — fail open",
    );
  }
}

// ---------------------------------------------------------------------------
// Semantic pre-check helper used by citation-verifier
// ---------------------------------------------------------------------------

export interface SemanticMatchResult {
  /** Whether the similarity exceeds the configured threshold. */
  matches: boolean;
  /** Raw cosine similarity score 0–1. */
  similarity: number;
  /** Indicates an embedding was available to compare against. */
  hadEmbedding: boolean;
}

/**
 * Compare a claim string against a section's stored embedding.
 * Returns `hadEmbedding: false` when the section has no embedding (fail open).
 */
export async function semanticMatch(
  claimText: string,
  sectionEmbedding: Uint8Array | null,
  config: EmbeddingConfig,
): Promise<SemanticMatchResult> {
  if (!sectionEmbedding) {
    return { matches: true, similarity: 0, hadEmbedding: false };
  }
  const claimVector = await embed(claimText, config);
  if (!claimVector) {
    return { matches: true, similarity: 0, hadEmbedding: false };
  }
  const sectionVector = deserializeEmbedding(sectionEmbedding);
  const similarity = cosineSimilarity(claimVector, sectionVector);
  const threshold = config.threshold ?? 0.6;
  return { matches: similarity >= threshold, similarity, hadEmbedding: true };
}
