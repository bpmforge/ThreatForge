/**
 * TargetAssetDetector stage handler: attack-chain Pass 2 (target asset detection).
 *
 * One LLM call asks which components are the highest-value targets (sensitive
 * data / privileged capability). Returned component ids are validated against
 * the model's topology (attack-chain-detect.ts): hallucinated ids are DROPPED
 * and counted as parseFailures.
 *
 * Override path: when the ATTACK_CHAIN_ANALYSIS payload supplies explicit
 * `targetAssets` (component ids), Pass 2 is skipped entirely. At the pipeline
 * level that is a stage `condition` (no override → run). This handler ALSO
 * honours an in-band `targetAssetsOverride` so a direct invocation resolves the
 * supplied ids from topology WITHOUT an LLM call (hallucinated overrides are
 * still dropped + counted).
 *
 * Output `{ targetAssets }` feeds Pass 3 (path generation).
 */
import type { ThreatModelContext } from "../../../types/ai.js";
import type { ParseFailure } from "../micro-analysis/types.js";
import {
  TargetAssetArrayZ,
  type TargetAssetZShape,
} from "../schemas/llm-response-schemas.js";
import {
  TARGET_ASSET_SYSTEM_PROMPT,
  buildAttackChainSummary,
  buildTargetAssetUserPrompt,
} from "../prompts/attack-chain.js";
import { detectComponents } from "./attack-chain-detect.js";
import type { StageContext, StageResult } from "./registry.js";
import logger from "../../../utils/logger.js";

interface TargetAssetDetectorInputs {
  context: ThreatModelContext;
  /** Explicit target component ids from the job payload — skips the LLM call. */
  targetAssetsOverride?: string[];
}

/** A target asset with its component name resolved from the model. */
export type DetectedTargetAsset = TargetAssetZShape & {
  componentName: string;
};

/** Resolve override ids against topology — hallucinated ids dropped + counted. */
function fromOverride(
  ids: string[],
  context: ThreatModelContext,
): {
  items: DetectedTargetAsset[];
  parseFailures: ParseFailure[];
  hallucinatedIds: string[];
} {
  const nameById = new Map(context.components.map((c) => [c.id, c.name]));
  const items: DetectedTargetAsset[] = [];
  const hallucinatedIds: string[] = [];
  const parseFailures: ParseFailure[] = [];
  ids.forEach((componentId, index) => {
    const componentName = nameById.get(componentId);
    if (componentName === undefined) {
      hallucinatedIds.push(componentId);
      parseFailures.push({
        stage: "attack-chain",
        index,
        error: `Override targetAsset "${componentId}" — not in model topology; dropped`,
      });
      return;
    }
    items.push({
      componentId,
      componentName,
      justification: "Specified target asset (job payload override)",
    });
  });
  return { items, parseFailures, hallucinatedIds };
}

export async function targetAssetDetectorStage(
  ctx: StageContext,
): Promise<StageResult> {
  const { context, targetAssetsOverride } =
    ctx.inputs as unknown as TargetAssetDetectorInputs;
  if (!context)
    throw new Error("TargetAssetDetector requires inputs.context for topology");

  // Override path — resolve supplied ids, no LLM call (Pass 2 skipped).
  if (Array.isArray(targetAssetsOverride) && targetAssetsOverride.length > 0) {
    const { items, parseFailures, hallucinatedIds } = fromOverride(
      targetAssetsOverride,
      context,
    );
    await ctx.progress(
      100,
      `Target assets: ${items.length} from override, ${hallucinatedIds.length} dropped (Pass 2 skipped)`,
    );
    return {
      outputs: { targetAssets: items, hallucinatedIds, parseFailures },
      tokensUsed: 0,
      parseFailures,
    };
  }

  await ctx.progress(
    10,
    `Target-asset detection: ${context.components.length} components`,
  );

  const summary = buildAttackChainSummary(context);
  const raw = await ctx.aiCall(
    TARGET_ASSET_SYSTEM_PROMPT,
    buildTargetAssetUserPrompt(summary),
  );

  const { items, parseFailures, hallucinatedIds } = detectComponents(
    raw,
    TargetAssetArrayZ,
    context,
  );

  if (hallucinatedIds.length > 0) {
    logger.warn(
      { hallucinatedIds, stage: "TargetAssetDetector" },
      "Dropped hallucinated target-asset component ids",
    );
  }

  await ctx.progress(
    100,
    `Target assets: ${items.length} found, ${hallucinatedIds.length} hallucinated dropped`,
  );

  return {
    outputs: {
      targetAssets: items satisfies DetectedTargetAsset[],
      hallucinatedIds,
      parseFailures,
    },
    tokensUsed: 0,
    parseFailures,
  };
}
