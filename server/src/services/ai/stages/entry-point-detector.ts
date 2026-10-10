/**
 * EntryPointDetector stage handler — attack-chain Pass 1.
 * AGENTIC_AI.md "Pass 1 — Entry Point Detection" (canonical).
 *
 * One adversarial-free LLM call asks which components are external-facing entry
 * points an attacker can reach without auth. Returned component ids are
 * validated against the model's topology (attack-chain-detect.ts): hallucinated
 * ids are DROPPED and counted as parseFailures, never trusted downstream.
 *
 * Output `{ entryPoints }` feeds Pass 3 (path generation).
 */
import type { ThreatModelContext } from "../../../types/ai.js";
import {
  EntryPointArrayZ,
  type EntryPointZShape,
} from "../schemas/llm-response-schemas.js";
import {
  ENTRY_POINT_SYSTEM_PROMPT,
  buildAttackChainSummary,
  buildEntryPointUserPrompt,
} from "../prompts/attack-chain.js";
import { detectComponents } from "./attack-chain-detect.js";
import type { StageContext, StageResult } from "./registry.js";
import logger from "../../../utils/logger.js";

interface EntryPointDetectorInputs {
  context: ThreatModelContext;
}

/** An entry point with its component name resolved from the model. */
export type DetectedEntryPoint = EntryPointZShape & { componentName: string };

export async function entryPointDetectorStage(
  ctx: StageContext,
): Promise<StageResult> {
  const { context } = ctx.inputs as unknown as EntryPointDetectorInputs;
  if (!context)
    throw new Error("EntryPointDetector requires inputs.context for topology");

  await ctx.progress(
    10,
    `Entry-point detection: ${context.components.length} components`,
  );

  const summary = buildAttackChainSummary(context);
  const raw = await ctx.aiCall(
    ENTRY_POINT_SYSTEM_PROMPT,
    buildEntryPointUserPrompt(summary),
  );

  const { items, parseFailures, hallucinatedIds } = detectComponents(
    raw,
    EntryPointArrayZ,
    context,
  );

  if (hallucinatedIds.length > 0) {
    logger.warn(
      { hallucinatedIds, stage: "EntryPointDetector" },
      "Dropped hallucinated entry-point component ids",
    );
  }

  await ctx.progress(
    100,
    `Entry points: ${items.length} found, ${hallucinatedIds.length} hallucinated dropped`,
  );

  return {
    outputs: {
      entryPoints: items satisfies DetectedEntryPoint[],
      hallucinatedIds,
      parseFailures,
    },
    tokensUsed: 0,
    parseFailures,
  };
}
