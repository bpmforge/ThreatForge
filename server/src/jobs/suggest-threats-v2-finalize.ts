/**
 * SUGGEST_THREATS v2 — final persist + summary.
 *
 * Ports of the tail of micro-analysis/pipeline.ts `runMicroAnalysis`:
 * the ADR-006 final `persistAIThreats` call (sessionId-tagged,
 * ACCEPTED/REJECTED/MODIFIED rows untouched by construction), the
 * streaming-write loser cleanup, the result summary, and the legacy
 * worker's analyzedAt write-back for dirty components. Logic is copied,
 * not reinterpreted — if pipeline.ts / ai-worker.ts change, change this
 * the same way.
 */
import type { PrismaClient } from "@prisma/client";
import type { AIProviderClient, ThreatModelContext } from "../types/ai.js";
import type { AttackChain } from "../services/threat-generation/attack-chain-analyzer.js";
import type {
  AICallFn,
  MicroAnalysisOptions,
  MicroAnalysisResult,
  MicroThreat,
  ParseFailure,
} from "../services/ai/micro-analysis/types.js";
import { persistAIThreats } from "../services/threat-review/review-service.js";
import {
  markDedupLosers,
  reportFinalPersist,
  toComponentContext,
} from "../services/ai/micro-analysis/pipeline.js";
import { runMitigationPass } from "../services/ai/micro-analysis/mitigation-pass.js";
import { POST_MITIGATION_SOURCES } from "../services/ai/stages/mitigation-synthesizer.js";
import { buildNodeIdMaps } from "../services/ai/stages/identifier-context.js";
import { applyConfidenceFloor } from "../services/ai/micro-analysis/confidence-floor.js";
import {
  guardOutcome,
  runDuplicateGuard,
  type DuplicateGuardResult,
} from "../services/ai/dedup/duplicate-guard.js";
import { persistSharedControls } from "../services/ai/dedup/shared-controls.js";
import logger from "../utils/logger.js";

export interface FinalizeV2Args {
  prisma: PrismaClient;
  context: ThreatModelContext;
  persist?: { threatModelId: string; userId: string; sessionId?: string };
  /** Citation verification on final persist — legacy passes the job client. */
  verifyClient?: AIProviderClient;
  /** SeverityCalibrator output — calibrated + deduped final set. */
  deduped: MicroThreat[];
  /**
   * Minimum `confidence` a threat must clear to be persisted (0-1).
   * Defaults to DEFAULT_MIN_PERSIST_CONFIDENCE when unset, same as the
   * legacy path's MicroAnalysisOptions.minPersistConfidence default.
   */
  minPersistConfidence?: number;
  attackChains: AttackChain[];
  parseFailures: ParseFailure[];
  methodologies: MicroAnalysisOptions["methodologies"];
  llmCalls: number;
  /**
   * Style-wrapped caller for the final mitigation pass. When set, the
   * identification threats that survive dedup and the floor get their
   * mitigations here, batched exactly as the legacy pipeline batches them.
   * Unset in mitigations-only mode (the MitigationSynthesizer stage already
   * mitigated the preseeded threats).
   */
  mitigationAiCall?: AICallFn;
  /**
   * Duplicate guard: caller for the existing LLM dedup prompt, asked only
   * about review-band pairs (the detector verifies every answer). Unset →
   * detector-only.
   */
  dedupAiCall?: AICallFn;
  /**
   * Mitigations-only mode re-mitigates EXISTING rows; merging two of them in
   * memory would silently skip the loser's refresh, so the guard stays off.
   */
  skipDuplicateGuard?: boolean;
  skippedComponentCount: number;
  startTime: number;
  /** Worker-level analyzedAt write-back targets (legacy dirty set). */
  dirtyComponentDbIds: Set<string>;
  /**
   * Fan-out children that failed this run (§2.3). Non-empty → the job
   * completes COMPLETED with `partial: true` and these surfaced for the
   * "retry failed units" UI affordance.
   */
  failedUnits?: Array<{ componentId: string; category: string; error: string }>;
  /**
   * Present on a retry-failed run. Restricts the loser cleanup to
   * the retried (componentId, category) targets so prior survivors on the same
   * sessionId are NEVER swept — the retry MERGES, it does not replace.
   */
  retryUnits?: Array<{ componentId: string; category: string }>;
  /**
   * Challenger-gate (Verifier) outcome counts, surfaced in the job
   * summary as "N confirmed · M refuted & removed · K uncertain". Absent when
   * the Verifier stage did not run (flag off / pipeline without the stage).
   */
  verification?: { confirmed: number; uncertain: number; refuted: number };
  report: (phase: string, detail: string) => void;
}

/** Port of pipeline.ts "Persist to database" + loser cleanup blocks. */
async function persistFinalSet(
  args: FinalizeV2Args,
  guard: DuplicateGuardResult,
): Promise<Parameters<typeof guardOutcome>[1]> {
  const { prisma, persist, verifyClient, deduped, report } = args;
  if (!persist) return {};

  report("persist", "Saving threats to database (respecting human reviews)...");
  const persistResult = await persistAIThreats(
    persist.threatModelId,
    persist.userId,
    deduped,
    verifyClient,
    undefined, // no batch scope — final persist writes all
    persist.sessionId,
  );
  reportFinalPersist(persistResult, deduped.length, args.parseFailures, report);

  // --- Loser marking --- (streaming-write rows the LLM dedup dropped;
  // scoped to this session, PENDING AI_SUGGESTED, manuallyEdited=false).
  // Calls the shared markDedupLosers (micro-analysis/pipeline.ts)
  // instead of maintaining a second copy of this logic — see that function's
  // doc comment for why marking (never deleting) replaced the old deleteMany.
  const persisted: Parameters<typeof guardOutcome>[1] = {
    linked: persistResult.linked,
  };
  if (!persist.sessionId) return persisted;
  const { dbIdToNodeId } = await buildNodeIdMaps(persist.threatModelId);

  // On a retry-failed run the pipeline only produced threats for the
  // retried units, so `deduped` is a SUBSET of the session. Restricting the
  // sweep to the retried components' nodeIds keeps prior survivors intact —
  // the retry merges into the existing set. Without this guard the sweep would
  // misclassify every threat the first run already persisted as a loser.
  const retryNodeIds = args.retryUnits?.length
    ? new Set(
        args.retryUnits
          .map((u) => dbIdToNodeId.get(u.componentId))
          .filter((n): n is string => !!n),
      )
    : null;

  const { unconfirmed } = await markDedupLosers({
    threatModelId: persist.threatModelId,
    sessionId: persist.sessionId,
    deduped,
    dbIdToNodeId,
    nodeIdScope: retryNodeIds,
    guardMerges: guard.merges,
    prisma,
    report,
  });
  persisted.unconfirmed = unconfirmed;
  // A retry run only holds the retried units, so its shared-control groups
  // are partial; leave the full run's groups in place.
  if (!retryNodeIds) {
    await persistSharedControls({
      prisma,
      threatModelId: persist.threatModelId,
      sessionId: persist.sessionId,
      groups: guard.controlGroups,
      dbIdToNodeId,
      linked: persistResult.linked,
    });
  }
  return persisted;
}

/**
 * Additive job-result extension. The `MicroAnalysisResult` shape
 * is preserved; `partial`/`failedUnits` are extra top-level keys (the frontend
 * poller ignores unknown keys). They survive the worker's COMPLETED block,
 * which spreads the result and only rewrites `summary`/`parseFailuresSamples`.
 */
export type FinalizeV2Result = MicroAnalysisResult & {
  /** True when ≥1 fan-out unit failed; the job still COMPLETES (§2.3). */
  partial?: boolean;
  /** The pairs that failed — drives "retry failed units". */
  failedUnits?: Array<{ componentId: string; category: string; error: string }>;
};

/**
 * Confidence floor + mitigation pass on the v2 final set, in the legacy order:
 * floor first, then mitigations on the surviving identification threats
 * through the shared pass (so the batches match the legacy pipeline's).
 * Exported so tests can compare against exactly this step.
 */
export async function floorAndMitigateV2Final(args: {
  threats: MicroThreat[];
  minPersistConfidence?: number;
  context: ThreatModelContext;
  mitigationAiCall?: AICallFn;
  /** Duplicate guard's LLM caller (review-band pairs only). */
  dedupAiCall?: AICallFn;
  skipDuplicateGuard?: boolean;
  parseFailures: ParseFailure[];
  report: (phase: string, detail: string) => void;
}): Promise<{
  kept: MicroThreat[];
  droppedCount: number;
  llmCalls: number;
  guard: DuplicateGuardResult;
}> {
  const isIdentification = (t: MicroThreat) =>
    t.componentId !== "compound" &&
    !POST_MITIGATION_SOURCES.has(t.sourceMethodology);
  const hadIdentification = args.threats.some(isIdentification);
  const { kept, droppedCount } = applyConfidenceFloor(
    args.threats,
    args.minPersistConfidence,
  );
  let llmCalls = 0;
  if (args.mitigationAiCall && hadIdentification) {
    const pass = await runMitigationPass({
      aiCall: args.mitigationAiCall,
      threats: kept,
      isIdentification,
      componentContexts: args.context.components.map((comp) =>
        toComponentContext(comp, args.context),
      ),
      requirements: args.context.requirements,
      parseFailures: args.parseFailures,
      report: args.report,
    });
    llmCalls = pass.llmCalls;
  }
  // Duplicate guard — same position as the legacy tail: after the mitigation
  // pass (its prompts are unchanged), before persist.
  const guard = await runDuplicateGuard(args.skipDuplicateGuard ? [] : kept, {
    aiCall: args.dedupAiCall,
    report: args.report,
  });
  llmCalls += guard.metrics.llmCalls;
  return {
    kept: args.skipDuplicateGuard ? kept : guard.threats,
    droppedCount,
    llmCalls,
    guard,
  };
}

/**
 * Final persist + summary build + analyzedAt write-back. Returns the
 * `MicroAnalysisResult` shape the legacy path stores as AiJob.result (the
 * worker's shared COMPLETED block then applies the same parse-failure
 * enrichment to both paths), plus the additive `partial`/`failedUnits`.
 */
export async function finalizeV2Run(
  args: FinalizeV2Args,
): Promise<FinalizeV2Result> {
  const { prisma, context, persist, report } = args;

  // Port of pipeline.ts's persistence-time confidence floor. Runs
  // before persistFinalSet so both the persisted rows and the summary
  // below agree on the same final set; see confidence-floor.ts.
  const {
    kept: deduped,
    droppedCount: droppedLowConfidence,
    llmCalls,
    guard,
  } = await floorAndMitigateV2Final({
    threats: args.deduped,
    minPersistConfidence: args.minPersistConfidence,
    context,
    mitigationAiCall: args.mitigationAiCall,
    dedupAiCall: args.dedupAiCall,
    skipDuplicateGuard: args.skipDuplicateGuard,
    parseFailures: args.parseFailures,
    report,
  });
  args.deduped = deduped;
  args.llmCalls += llmCalls;

  const dedupOutcome = guardOutcome(guard, await persistFinalSet(args, guard));

  // --- Build summary (port of pipeline.ts — counts match what was persisted) ---
  const categoryCoverage: Record<string, number> = {};
  for (const t of deduped) {
    categoryCoverage[t.category] = (categoryCoverage[t.category] || 0) + 1;
  }
  const coveredComponents = new Set(
    deduped
      .filter((t) => t.componentId !== "compound")
      .map((t) => t.componentId),
  );

  const failedUnits = args.failedUnits ?? [];
  const result: FinalizeV2Result = {
    threats: deduped.filter((t) => t.componentId !== "compound"),
    attackChains: args.attackChains,
    compoundThreats: deduped.filter((t) => t.componentId === "compound"),
    parseFailures: args.parseFailures,
    // Additive and only present when the guard found something, so a run with
    // nothing to report keeps the result shape unchanged.
    ...(dedupOutcome.report ? { dedup: dedupOutcome.report } : {}),
    // Additive partial-failure markers — only present when something
    // failed, so a clean run's result is byte-identical to before.
    ...(failedUnits.length > 0 ? { partial: true, failedUnits } : {}),
    summary: {
      totalThreats: deduped.length,
      componentsAnalyzed: context.components.length,
      categoriesPerComponent: args.methodologies.reduce((sum, m) => {
        if (m === "stride") return sum + 6;
        if (m === "pasta") return sum + 8;
        if (m === "kill_chain") return sum + 6;
        return sum;
      }, 0),
      categoryCoverage,
      componentsCovered: coveredComponents.size,
      totalComponents: context.components.length,
      llmCalls: args.llmCalls,
      duration: Date.now() - args.startTime,
      skippedComponentCount: args.skippedComponentCount,
      parseFailures: args.parseFailures.length,
      droppedLowConfidence,
      dedup: dedupOutcome.metrics,
      // Additive — only present when the Verifier stage ran.
      ...(args.verification ? { verification: args.verification } : {}),
    },
  };

  logger.info(
    {
      threats: result.summary.totalThreats,
      components: result.summary.componentsAnalyzed,
      covered: result.summary.componentsCovered,
      chains: args.attackChains.length,
      compounds: result.compoundThreats.length,
      llmCalls: args.llmCalls,
      duration: result.summary.duration,
    },
    "Micro-analysis pipeline complete (unified v2 path)",
  );
  report(
    "done",
    `${result.summary.totalThreats} threats, ${coveredComponents.size}/${context.components.length} components covered`,
  );

  // --- Port of the legacy worker's analyzedAt write-back for dirty components ---
  if (args.dirtyComponentDbIds.size > 0 && persist?.threatModelId) {
    await prisma.component
      .updateMany({
        where: {
          id: { in: [...args.dirtyComponentDbIds] },
          threatModelId: persist.threatModelId,
        },
        data: { analyzedAt: new Date() },
      })
      .catch((err) =>
        logger.warn(
          { err, threatModelId: persist.threatModelId },
          "Failed to write analyzedAt",
        ),
      );
  }

  return result;
}
