/**
 * Legacy-vs-stage-wrapped parity runners. Shared by the parity CLI
 * (scripts/parity-run.ts --stage-wrapped) and parity-stage-wrapped.test.ts.
 *
 * COMPARISON DESIGN (documented choice): both paths run WITHOUT a `persist`
 * arg, so nothing is written to any DB — we compare in-memory result sets
 * before persistence. That matches how the journal was recorded and how
 * parity-run's golden mode runs the legacy pipeline (persist-free), so no
 * per-path test databases are needed.
 *
 * Capture points:
 * - Legacy identification set = the last `onCheckpoint` snapshot — the loop's
 *   exact output BEFORE the mitigation pass (the stage boundary). The legacy
 *   result's final `compoundThreats` (post-calibration/post-LLM-dedup) are
 *   returned separately for the compound superset check.
 * - Stage-wrapped set = ThreatIdentifier handler `outputs.threats`, split on
 *   the `compound` componentId sentinel.
 * Byte-equivalence of the compound sub-step is enforced by replay itself:
 * the handler's compound prompt must hash-match the journal entry recorded
 * from a legacy run, or the run throws ReplayMiss.
 */
import { runMicroAnalysis } from "../../services/ai/micro-analysis/pipeline.js";
import type {
  AICallFn,
  MicroThreat,
} from "../../services/ai/micro-analysis/types.js";
import { registerStageHandlers } from "../../services/ai/stages/index.js";
import { getStage } from "../../services/ai/stages/registry.js";
import type { ThreatModelContext } from "../../types/ai.js";

export interface IdentificationRun {
  /** Per-(component, category) loop output (no compound threats). */
  loopThreats: MicroThreat[];
  /** Compound (cross-component) threats. */
  compoundThreats: MicroThreat[];
}

/**
 * Run the legacy micro pipeline and capture the identification-phase set
 * via onCheckpoint (fires after each component with all threats so far).
 */
export async function runLegacyIdentification(
  context: ThreatModelContext,
  aiCall: AICallFn,
): Promise<IdentificationRun> {
  let loopThreats: MicroThreat[] = [];
  const result = await runMicroAnalysis(context, aiCall, {
    methodologies: ["stride"],
    onCheckpoint: async (_componentId, allThreatsSoFar) => {
      loopThreats = allThreatsSoFar;
    },
  });
  return { loopThreats, compoundThreats: result.compoundThreats };
}

/**
 * Run the legacy micro pipeline to its FINAL set (the full-pipeline parity
 * comparison point): identification + mitigations + supplemental (persist-
 * gated, absent here) + compound + calibration + LLM dedup. Returns
 * loop and compound threats merged, exactly what the v2 SeverityCalibrator
 * stage emits as `calibratedThreats`.
 */
export async function runLegacyFull(
  context: ThreatModelContext,
  aiCall: AICallFn,
): Promise<MicroThreat[]> {
  const result = await runMicroAnalysis(context, aiCall, {
    methodologies: ["stride"],
  });
  return [...result.threats, ...result.compoundThreats];
}

/** Run the ThreatIdentifier stage handler on the same context + caller. */
export async function runStageWrappedIdentification(
  context: ThreatModelContext,
  aiCall: AICallFn,
): Promise<IdentificationRun> {
  // Idempotent; guards against a test file resetting the shared registry.
  registerStageHandlers();
  const handler = getStage("ThreatIdentifier");
  const result = await handler({
    executionId: "parity-execution",
    threatModelId: "parity-threat-model",
    organizationId: "parity-org",
    sessionId: "parity-session",
    inputs: { context, options: { methodologies: ["stride"] } },
    aiCall,
    progress: async () => undefined,
    checkpoint: async () => undefined,
    signal: new AbortController().signal,
  });
  const threats = result.outputs.threats as MicroThreat[];
  return {
    loopThreats: threats.filter((t) => t.componentId !== "compound"),
    compoundThreats: threats.filter((t) => t.componentId === "compound"),
  };
}
