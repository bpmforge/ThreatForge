/**
 * chunked first pass: one call analyzes a fixed group of categories for
 * one component, instead of one call per category.
 *
 * Safety net: every problem degrades to the existing per-category path
 * (analyzeSingleCategory), which keeps its minimal-prompt and retry handling:
 *  - the chunk call fails (after the same bounded retry)  → all categories fall back
 *  - the reply has no parseable JSON object (incl. a truncated reply) → all fall back
 *  - a category's key is missing or not {threats: []} / []  → that category falls back
 * Bookkeeping stays per category: each returned threat is attributed to the key
 * it came under, and refineCategoryThreats (citation re-emit, confidence
 * follow-up) runs once per category, exactly as on the single-category path.
 */
import type { ComponentContext } from "../../threat-generation/context-aware-pipeline.js";
import { extractJsonObject } from "../response-parsers.js";
import {
  analyzeSingleCategory,
  parseAndNormalize,
  refineCategoryThreats,
} from "./category-analyzer.js";
import { buildCategoryChunkPrompt } from "./micro-prompt-builder.js";
import type {
  AICallFn,
  CategoryReferenceData,
  MicroThreat,
  ParseFailure,
} from "./types.js";
import { withRetry } from "./with-retry.js";
import logger from "../../../utils/logger.js";

/** Categories per chunk: STRIDE → [S,T,R] [I,D,E]. Fixed, never data-dependent. */
export const CATEGORY_CHUNK_SIZE = 3;

/** Fixed partition of a methodology's category list into chunks (order kept). */
export function chunkCategories(categories: readonly string[]): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < categories.length; i += CATEGORY_CHUNK_SIZE) {
    chunks.push(categories.slice(i, i + CATEGORY_CHUNK_SIZE));
  }
  return chunks;
}

export interface ChunkCategoryInput {
  category: string;
  refs: CategoryReferenceData;
  refutedThreats?: Array<{ name: string; reason?: string }>;
}

export interface ChunkCategoryResult {
  category: string;
  threats: MicroThreat[];
  parseFailures: ParseFailure[];
  /** True when this category went through the single-category fallback. */
  fellBack: boolean;
}

type SequenceFlows = Array<{
  from: string;
  to: string;
  label: string;
  protocol?: string;
  authentication?: string;
}>;

interface ChunkOptions {
  minConfidence: number;
  maxLoops: number;
  minCitationCoverage?: number;
  retrySleep?: (ms: number) => Promise<void>;
}

/** Threats + gaps for one category from the chunk reply, or null if unusable. */
function readCategoryEntry(
  obj: Record<string, unknown>,
  category: string,
): { threats: unknown[]; gaps: string[] } | null {
  const entry = obj[category];
  if (Array.isArray(entry)) return { threats: entry, gaps: [] };
  if (!entry || typeof entry !== "object") return null;
  const { threats, gaps } = entry as { threats?: unknown; gaps?: unknown };
  if (!Array.isArray(threats)) return null;
  const gapList = Array.isArray(gaps)
    ? gaps
        .filter((g): g is string => typeof g === "string")
        .map((g) => g.trim())
        .filter(Boolean)
    : [];
  return { threats, gaps: gapList };
}

export async function analyzeCategoryChunk(
  aiCall: AICallFn,
  component: ComponentContext,
  methodology: string,
  chunk: ChunkCategoryInput[],
  options: ChunkOptions,
  sequenceFlows?: SequenceFlows,
): Promise<{ results: ChunkCategoryResult[]; llmCalls: number }> {
  let llmCalls = 0;
  // Every provider call — chunk, retries, follow-ups, fallbacks — goes through
  // this wrapper, so llmCalls is exact.
  const counted = countingCall(aiCall, () => llmCalls++);

  const fallback = async (
    c: ChunkCategoryInput,
  ): Promise<ChunkCategoryResult> => {
    const r = await analyzeSingleCategory(
      counted,
      component,
      c.category,
      methodology,
      c.refs,
      options,
      sequenceFlows,
      c.refutedThreats,
    );
    return { category: c.category, ...r, fellBack: true };
  };

  // One category (e.g. a single-category retry): the existing path, unchanged.
  if (chunk.length === 1) {
    const r = await fallback(chunk[0]);
    return { results: [{ ...r, fellBack: false }], llmCalls };
  }

  const { system, user } = buildCategoryChunkPrompt(
    component,
    chunk,
    sequenceFlows,
  );
  let raw: string;
  try {
    raw = await withRetry(() => counted(system, user, "category-chunk"), {
      sleep: options.retrySleep,
      isRetryable: (err) =>
        !(err instanceof Error && err.message.includes("400")),
    });
  } catch (err) {
    logger.warn(
      {
        err,
        component: component.name,
        categories: chunk.map((c) => c.category),
      },
      "Category chunk call failed — falling back to one call per category",
    );
    const results: ChunkCategoryResult[] = [];
    for (const c of chunk) results.push(await fallback(c));
    return { results, llmCalls };
  }

  const obj = extractJsonObject(raw);
  const results: ChunkCategoryResult[] = [];
  for (const c of chunk) {
    const entry = obj ? readCategoryEntry(obj, c.category) : null;
    if (!entry) {
      logger.warn(
        {
          component: component.name,
          category: c.category,
          parsed: Boolean(obj),
        },
        "Category missing from chunk reply — falling back to its own call",
      );
      results.push(await fallback(c));
      continue;
    }
    const parseFailures: ParseFailure[] = [];
    const firstPass = parseAndNormalize(
      JSON.stringify(entry.threats),
      component.id,
      component.name,
      c.category,
      methodology,
      parseFailures,
    );
    const threats = await refineCategoryThreats(
      counted,
      component,
      c.category,
      methodology,
      c.refs,
      options,
      firstPass,
      entry.gaps,
      parseFailures,
    );
    results.push({
      category: c.category,
      threats,
      parseFailures,
      fellBack: false,
    });
  }
  return { results, llmCalls };
}

/** Wraps a caller so follow-up calls are counted. */
function countingCall(aiCall: AICallFn, onCall: () => void): AICallFn {
  return async (system, user, stage) => {
    onCall();
    return aiCall(system, user, stage);
  };
}
