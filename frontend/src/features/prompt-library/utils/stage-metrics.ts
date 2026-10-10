/**
 * Stage metrics helpers — cache-hit detection + cost estimation for the
 * unified `threat-analysis-v2` cost/latency UI.
 *
 * Cache hits are NOT a persisted column (the pipeline writes no `cacheHit` flag — see
 * `server/src/services/ai/pipeline-service.ts`). Instead, a cache hit is the
 * unambiguous signature the stage cache leaves on the stage-execution row: the stage is
 * COMPLETED, its `durationMs` is exactly 0 (the handler never ran), yet
 * `tokensUsed` carries the ORIGINAL spend from the cached run. A genuinely
 * executed handler always takes > 0 ms, so this signature has no false
 * positives. Deriving it here avoids a schema migration.
 */
import type { PipelineStageExecution } from "../types";

/**
 * Default blended cost estimate, USD per 1,000 tokens. ThreatForge runs against
 * local LLMs (LM Studio / Ollama) where marginal token cost is ~0, so this is a
 * deliberately coarse upper-bound for capacity planning, not a billing figure.
 * Roughly the blended input+output rate of a small hosted model.
 */
const DEFAULT_USD_PER_1K_TOKENS = 0.0005;

/**
 * True when a stage was served from the stage cache rather than executed.
 * Signature: COMPLETED + durationMs === 0 + tokensUsed > 0 (see file header).
 */
export function isCacheHit(stage: PipelineStageExecution): boolean {
  return (
    stage.status === "COMPLETED" &&
    stage.durationMs === 0 &&
    (stage.tokensUsed ?? 0) > 0
  );
}

/**
 * Estimated USD cost for a token count. Cache hits cost 0 new tokens this run,
 * so callers pass the run-level (non-cached) token total for an accurate figure.
 */
export function estimateCostUsd(
  tokens: number,
  usdPer1kTokens: number = DEFAULT_USD_PER_1K_TOKENS,
): number {
  if (tokens <= 0) return 0;
  return (tokens / 1000) * usdPer1kTokens;
}

/** Format a USD cost for display (sub-cent figures shown to 4 dp). */
export function formatCostUsd(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
