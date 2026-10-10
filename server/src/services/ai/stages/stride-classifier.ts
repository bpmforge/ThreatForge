/**
 * StrideClassifier stage handler: validates (and, behind an option, repairs)
 * STRIDE category labels on the merged threat list. Skipped entirely via the
 * seeded stage `condition` when methodology !== STRIDE.
 *
 * Repairs change threats relative to the legacy pipeline, which has no such
 * pass, so the stage defaults to validate-only: no LLM call, threats pass
 * through unchanged, and invalid labels are surfaced in `invalidCategories`.
 * Repair mode (one cheap LLM call per batch of up to 25 threats) only runs
 * when the stage is given `repairCategories: true` via inputMapping.
 */
import { extractJsonArray } from "../response-parsers.js";
import type { MicroThreat, ParseFailure } from "../micro-analysis/types.js";
import { STRIDE_CATEGORIES } from "../micro-analysis/types.js";
import type { StageContext, StageResult } from "./registry.js";
import logger from "../../../utils/logger.js";

/** One cheap LLM call per batch of at most this many threats (task spec). */
export const CLASSIFIER_BATCH_SIZE = 25;

const VALID_CATEGORIES = new Set<string>(STRIDE_CATEGORIES);

interface StrideClassifierInputs {
  threats: MicroThreat[];
  methodology?: string;
  /** Opt-in repair mode; off by default (see module doc). */
  repairCategories?: boolean;
}

interface InvalidCategoryReport {
  name: string;
  componentId: string;
  category: string;
}

export async function strideClassifierStage(
  ctx: StageContext,
): Promise<StageResult> {
  const { threats, repairCategories } =
    ctx.inputs as unknown as StrideClassifierInputs;
  if (!Array.isArray(threats)) {
    throw new Error("StrideClassifier requires inputs.threats");
  }

  const invalidCategories: InvalidCategoryReport[] = threats
    .filter((t) => !VALID_CATEGORIES.has(t.category))
    .map((t) => ({
      name: t.name,
      componentId: t.componentId,
      category: t.category,
    }));

  if (!repairCategories) {
    await ctx.progress(
      100,
      `STRIDE labels validated: ${invalidCategories.length}/${threats.length} ` +
        `invalid (validate-only; repair is turned off)`,
    );
    return {
      outputs: {
        classifiedThreats: threats,
        invalidCategories,
        parseFailures: [],
      },
      tokensUsed: 0,
      parseFailures: [],
    };
  }

  // --- Repair mode: one LLM call per batch of ≤ 25 threats ---
  const parseFailures: ParseFailure[] = [];
  const classifiedThreats = [...threats];
  const batches = Math.ceil(threats.length / CLASSIFIER_BATCH_SIZE);
  for (let b = 0; b < batches; b++) {
    const start = b * CLASSIFIER_BATCH_SIZE;
    const batch = threats.slice(start, start + CLASSIFIER_BATCH_SIZE);
    try {
      const corrections = await repairBatch(ctx, batch, start);
      for (const { index, category } of corrections) {
        classifiedThreats[index] = { ...classifiedThreats[index], category };
      }
    } catch (err) {
      logger.warn(
        { err, batch: b },
        "StrideClassifier repair batch failed; keeping original labels",
      );
      parseFailures.push({
        stage: "threat-generation", // closed ParseFailure union; see component
        component: "stride-classifier",
        index: b,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    await ctx.progress(
      Math.round(((b + 1) / batches) * 100),
      `STRIDE label repair: batch ${b + 1}/${batches}`,
    );
  }

  return {
    outputs: { classifiedThreats, invalidCategories, parseFailures },
    tokensUsed: 0,
    parseFailures,
  };
}

/** Validate/repair one batch; returns absolute-index corrections. */
async function repairBatch(
  ctx: StageContext,
  batch: MicroThreat[],
  offset: number,
): Promise<Array<{ index: number; category: string }>> {
  const numbered = batch
    .map(
      (t, i) =>
        `${i}. [${t.category}] "${t.name}" — ${(t.description ?? "").slice(0, 150)}`,
    )
    .join("\n");
  const raw = await ctx.aiCall(
    "You validate STRIDE category labels on threats. The only valid labels are: " +
      `${STRIDE_CATEGORIES.join(", ")}. Return ONLY a JSON array of corrections ` +
      "for threats whose current label is clearly wrong. If every label is " +
      "correct, return [].",
    `Threats (current label in brackets):\n${numbered}\n\n` +
      `Return: [{"index":0,"category":"TAMPERING"}] — 0-based index within ` +
      `this list, corrected category. Corrections only; no other output.`,
  );
  const arr = extractJsonArray(raw);
  if (!arr)
    throw new Error("StrideClassifier: response did not parse as JSON array");

  const corrections: Array<{ index: number; category: string }> = [];
  for (const entry of arr) {
    const e = entry as { index?: unknown; category?: unknown };
    if (
      typeof e.index === "number" &&
      e.index >= 0 &&
      e.index < batch.length &&
      typeof e.category === "string" &&
      VALID_CATEGORIES.has(e.category) &&
      e.category !== batch[e.index].category
    ) {
      corrections.push({ index: offset + e.index, category: e.category });
    }
  }
  return corrections;
}
