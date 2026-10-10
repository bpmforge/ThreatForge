/**
 * PathGenerator stage handler — attack-chain Pass 3 (path generation).
 * See docs/architecture/AI_ARCHITECTURE.md.
 *
 * For each (entry point, target asset) pair — Passes 1/2 output, capped at
 * `maxChainPairs` (default 10, configurable) — one LLM call proposes up to 3
 * candidate attack chains. Each hop carries capability tokens
 * (`preconditions` it needs + `yields` it grants) plus the threat it exploits.
 *
 * Topology guard: a chain is DROPPED if any hop's componentId is not in the
 * model (same hallucination discipline as Passes 1/2 — counted as a
 * parseFailure). Surviving chains are NOT yet topology/capability validated —
 * that is code-based Pass 4. This stage emits CANDIDATE chains only.
 *
 * New threats: a hop may exploit a threat not yet recorded (`newThreat`). Those
 * are persisted AI_SUGGESTED through the NORMAL dedup path (ADR-006,
 * path-generator-persist.ts) and the hop's threatRef is rewritten to the
 * resolved handle — running twice dedups to one stored threat.
 *
 * Rollout: the whole attack-chain-v1 pipeline runs only when the org has the
 * `agent-chain-v2` flag (gated by the pipeline executor / ai-worker, as for
 * Passes 1/2). This handler is pure orchestration and never checks the flag itself.
 */
import type { ThreatModelContext } from "../../../types/ai.js";
import type { ParseFailure } from "../micro-analysis/types.js";
import {
  ChainArrayZ,
  safeParseArray,
  type ChainZShape,
} from "../schemas/llm-response-schemas.js";
import {
  PATH_GENERATION_SYSTEM_PROMPT,
  buildAttackChainSummary,
  buildPathGenerationUserPrompt,
  type ExistingThreatRef,
} from "../prompts/attack-chain.js";
import { persistHopNewThreat } from "./path-generator-persist.js";
import type { DetectedEntryPoint } from "./entry-point-detector.js";
import type { DetectedTargetAsset } from "./target-asset-detector.js";
import type { StageContext, StageResult } from "./registry.js";
import logger from "../../../utils/logger.js";

/** Default cap on (entry, target) pairs analysed per job (configurable). */
const DEFAULT_MAX_CHAIN_PAIRS = 10;
/** Default per-chain hop ceiling (Pass 3). */
const DEFAULT_MAX_CHAIN_DEPTH = 5;
/** Hard ceiling on candidate chains kept per (entry, target) pair. */
const MAX_CHAINS_PER_PAIR = 3;

interface PathGeneratorInputs {
  context: ThreatModelContext;
  entryPoints: DetectedEntryPoint[];
  targetAssets: DetectedTargetAsset[];
  /** Existing threats offered to the LLM for reuse (threatRef + name). */
  existingThreats?: ExistingThreatRef[];
  /** Persist new-threat hops AI_SUGGESTED (job path). DB-free when absent. */
  persist?: { threatModelId: string; userId: string };
  maxChainPairs?: number;
  maxChainDepth?: number;
}

/** A candidate chain with hop threatRefs resolved + entry/target names attached. */
export type CandidateChain = ChainZShape & {
  entryPointName: string;
  targetAssetName: string;
};

export async function pathGeneratorStage(
  ctx: StageContext,
): Promise<StageResult> {
  const inputs = ctx.inputs as unknown as PathGeneratorInputs;
  const { context, entryPoints, targetAssets, existingThreats, persist } =
    inputs;
  if (!context)
    throw new Error("PathGenerator requires inputs.context for topology");
  if (!Array.isArray(entryPoints) || !Array.isArray(targetAssets))
    throw new Error(
      "PathGenerator requires inputs.entryPoints and inputs.targetAssets",
    );

  const maxPairs = inputs.maxChainPairs ?? DEFAULT_MAX_CHAIN_PAIRS;
  const maxDepth = inputs.maxChainDepth ?? DEFAULT_MAX_CHAIN_DEPTH;
  const componentIds = new Set(context.components.map((c) => c.id));
  const nameById = new Map(context.components.map((c) => [c.id, c.name]));
  const summary = buildAttackChainSummary(context);

  // Build the capped pair list (entry × target), capped at maxPairs.
  const pairs: Array<{
    entry: DetectedEntryPoint;
    target: DetectedTargetAsset;
  }> = [];
  for (const entry of entryPoints) {
    for (const target of targetAssets) {
      if (entry.componentId === target.componentId) continue;
      if (pairs.length >= maxPairs) break;
      pairs.push({ entry, target });
    }
    if (pairs.length >= maxPairs) break;
  }

  await ctx.progress(
    5,
    `Path generation: ${pairs.length} (entry,target) pairs (cap ${maxPairs})`,
  );

  const candidateChains: CandidateChain[] = [];
  const parseFailures: ParseFailure[] = [];
  let newThreatsPersisted = 0;

  for (let i = 0; i < pairs.length; i++) {
    const { entry, target } = pairs[i];
    const raw = await ctx.aiCall(
      PATH_GENERATION_SYSTEM_PROMPT,
      buildPathGenerationUserPrompt(
        summary,
        entry,
        target,
        existingThreats ?? [],
        maxDepth,
      ),
    );

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      json = raw; // safeParseArray reports a structured "Not an array" failure
    }
    const { valid, failed } = safeParseArray(ChainArrayZ, json);
    for (const f of failed)
      parseFailures.push({
        stage: "attack-chain",
        index: f.index,
        error: f.error,
      });

    for (const chain of valid.slice(0, MAX_CHAINS_PER_PAIR)) {
      const cap = chain.hops.slice(0, maxDepth);
      const bad = cap.find((h) => !componentIds.has(h.componentId));
      if (bad) {
        parseFailures.push({
          stage: "attack-chain",
          index: i,
          error: `Chain "${chain.name}" dropped — hop componentId "${bad.componentId}" not in topology`,
        });
        continue;
      }

      // Persist any new-threat hops via the dedup path, rewrite their threatRef.
      for (const hop of cap) {
        if (!hop.newThreat) continue;
        if (persist) {
          const res = await persistHopNewThreat(
            persist.threatModelId,
            persist.userId,
            hop,
            nameById.get(hop.componentId) ?? hop.componentId,
            ctx.sessionId,
          );
          hop.threatRef = res.threatRef;
          newThreatsPersisted += res.created;
        }
      }

      candidateChains.push({
        ...chain,
        hops: cap,
        entryPointName: nameById.get(entry.componentId) ?? entry.componentId,
        targetAssetName: nameById.get(target.componentId) ?? target.componentId,
      });
    }

    await ctx.progress(
      5 + Math.round(((i + 1) / Math.max(pairs.length, 1)) * 90),
      `Path generation: pair ${i + 1}/${pairs.length}, ${candidateChains.length} candidate chains`,
    );
  }

  if (parseFailures.length > 0) {
    logger.warn(
      { count: parseFailures.length, stage: "PathGenerator" },
      "Path generation dropped invalid/hallucinated chains",
    );
  }

  await ctx.progress(
    100,
    `Path generation: ${candidateChains.length} candidate chains, ${newThreatsPersisted} new threats persisted`,
  );

  return {
    outputs: {
      candidateChains,
      newThreatsPersisted,
      parseFailures,
    },
    tokensUsed: 0,
    parseFailures,
  };
}
