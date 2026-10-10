/**
 * SeverityCalibrator stage handler — wraps the calibration tail of
 * micro-analysis/pipeline.ts:
 * 1. calibrateSeverities (micro-analysis/severity-calibrator.ts): dedup by
 *    (component, normalized name), rule-based attack-chain bump, optional
 *    EPSS downgrade (persist-gated org policy), one
 *    LLM consistency pass when ≥ 5 threats, severity sort.
 * 2. LLM semantic dedup (llm-dedup.ts) — runs immediately after calibration
 *    inside this stage. Failure-safe: any error falls back to the calibrated
 *    set unchanged.
 *
 * Consumes ThreatIdentifier's `attackChains` ride-along output via the seeded inputMapping.
 */
import type { AttackChain } from "../../threat-generation/attack-chain-analyzer.js";
import { isExternalEnrichmentAllowed } from "../../vuln-intel/enrichment-gate.js";
import { calibrateSeverities } from "../micro-analysis/severity-calibrator.js";
import type {
  MicroAnalysisOptions,
  MicroThreat,
} from "../micro-analysis/types.js";
import { wrapWithThreatStyle } from "./identifier-context.js";
import type { StageContext, StageResult } from "./registry.js";
import logger from "../../../utils/logger.js";

interface SeverityCalibratorInputs {
  threats: MicroThreat[];
  /** ThreatIdentifier ride-along output (compound sub-step). */
  attackChains?: AttackChain[];
  options?: Partial<MicroAnalysisOptions>;
  persist?: { threatModelId: string; userId: string; sessionId?: string };
}

export async function severityCalibratorStage(
  ctx: StageContext,
): Promise<StageResult> {
  const { threats, attackChains, options, persist } =
    ctx.inputs as unknown as SeverityCalibratorInputs;
  if (!Array.isArray(threats)) {
    throw new Error("SeverityCalibrator requires inputs.threats");
  }
  const report = options?.onProgress || (() => {});
  let llmCalls = 0;

  // Same threat-style wrap as the legacy calibration call site.
  const styledAiCall = await wrapWithThreatStyle(ctx.aiCall, persist?.userId);

  // EPSS calibration is persist-gated org policy — exactly like legacy.
  const epssEnabled = persist
    ? await isExternalEnrichmentAllowed(persist.threatModelId)
    : false;

  report("calibration", "Calibrating severities...");
  const calibrated = await calibrateSeverities(
    styledAiCall,
    threats,
    attackChains ?? [],
    { epssEnabled },
  );
  llmCalls++;
  await ctx.progress(50, `Calibrated ${calibrated.length} threats`);

  // --- LLM semantic dedup pass (non-load-bearing) ---
  let deduped = calibrated;
  if (calibrated.length >= 2) {
    try {
      const { dedupThreatsViaLLM } = await import(
        "../micro-analysis/llm-dedup.js"
      );
      report("dedup", "LLM semantic dedup pass...");
      deduped = await dedupThreatsViaLLM(styledAiCall, calibrated, {
        onProgress: (phase, detail) => report(phase, detail),
      });
      // Rough bound — dedupThreatsViaLLM makes at most 1 call per component
      llmCalls += new Set(calibrated.map((t) => t.componentId)).size;
    } catch (err) {
      logger.warn({ err }, "dedup failed; keeping calibrated set");
      deduped = calibrated;
    }
  }

  await ctx.progress(
    100,
    `Severity calibration complete: ${deduped.length} threats`,
  );

  return {
    outputs: { calibratedThreats: deduped, llmCalls, parseFailures: [] },
    tokensUsed: 0,
    parseFailures: [],
  };
}
