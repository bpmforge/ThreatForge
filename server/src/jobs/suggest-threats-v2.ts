/**
 * SUGGEST_THREATS via the unified threat-analysis-v2 pipeline.
 *
 * Flag-on (`agent-chain-v2`, micro mode only) replacement for the legacy
 * runMicroAnalysis call in ai-worker.ts. The job contract is kept by
 * construction:
 * - progress % / progressMessage / checkpoint writes go through the SAME
 *   ported phase mapping + onCheckpoint closure (suggest-threats-v2-presteps)
 * - persistence is the SAME ADR-006 path: streaming persistAIThreats inside
 *   the ThreatIdentifier stage (persist input), final persist + loser
 *   cleanup in suggest-threats-v2-finalize, every row tagged sessionId =
 *   AiJob.id so the worker's shared failure handler (cleanupSessionThreats)
 *   covers both paths identically
 * - the returned object is the exact MicroAnalysisResult shape; the worker's
 *   shared post-switch block (enrichment + COMPLETED write) then produces a
 *   byte-identical AiJob.result wrapper for both paths
 *
 * Design decisions:
 * - Mitigations-only preseed is ENABLED on this path: options.mitigationsOnly
 *   + persist flow through inputMetadata to the MitigationSynthesizer stage,
 *   which has DB context.
 * - StrideClassifier stays VALIDATE-ONLY: `repairCategories` defaults OFF
 *   (repairs would change threats relative to the legacy path). It is reachable
 *   via job input `repairCategories: true` for explicit opt-in only.
 * - All v2 stages are handler-backed, so the AIService passed to
 *   executePipeline is a throwing guard — a prompt-backed stage sneaking
 *   into this pipeline fails loudly instead of bypassing aiCall routing.
 */
import type { PrismaClient } from "@prisma/client";
import type { AIProviderClient, ThreatModelContext } from "../types/ai.js";
import type {
  AICallFn,
  MicroAnalysisOptions,
  ParseFailure,
} from "../services/ai/micro-analysis/types.js";
import type { AttackChain } from "../services/threat-generation/attack-chain-analyzer.js";
import type { AiJobData } from "./ai-queue.js";
import { createJobAIClient } from "./job-ai-client.js";
import {
  categoriesPerComponentFor,
  createProgressBridge,
  resolveResumeState,
  sweepOrphanThreats,
} from "./suggest-threats-v2-presteps.js";
import {
  generationSettingsFor,
  type GenerationStage,
} from "../services/ai/generation-settings.js";
import { finalizeV2Run } from "./suggest-threats-v2-finalize.js";
import { wrapWithThreatStyle } from "../services/ai/stages/identifier-context.js";
import {
  loadV2Pipeline,
  runPipelineRound,
} from "./suggest-threats-v2-round.js";
import {
  DISCOVERY_DEFAULT,
  runDiscoveryLoop,
  type DiscoveryConfig,
} from "./suggest-threats-v2-discovery.js";
import { computeDeadlineAt } from "../services/ai/job-deadline.js";

/** Subset of the SUGGEST_THREATS job input the v2 path consumes (legacy keys). */
interface SuggestThreatsV2Input {
  methodologies?: MicroAnalysisOptions["methodologies"];
  minConfidence?: number;
  force?: boolean;
  fullAnalysis?: boolean;
  componentNodeIds?: string[];
  categories?: string[];
  mitigationsOnly?: boolean;
  /** Explicit opt-in for StrideClassifier repair mode. Default OFF (see doc). */
  repairCategories?: boolean;
  /**
   * Retry-failed-units: re-run ONLY these (componentId, category) pairs
   * (a prior partial run's `result.failedUnits`). Set by the
   * `POST /api/ai-jobs/:jobId/retry-failed` route on the SAME job id, so the
   * sessionId is unchanged and results merge into the existing threat set.
   */
  retryUnits?: Array<{ componentId: string; category: string }>;
  /**
   * Loop-until-dry discovery (§2.6). Surfaced from the suggest-threats
   * route's advanced job options. Absent → the pipeline-definition default
   * (DISCOVERY_DEFAULT: mode "single") — exactly one plain pass.
   */
  discovery?: { mode?: "single" | "until-dry"; maxRounds?: number };
}

export interface RunSuggestThreatsV2Args {
  prisma: PrismaClient;
  data: AiJobData;
  input: SuggestThreatsV2Input;
  /** The worker's buildContext output — same context the legacy path uses. */
  context: ThreatModelContext;
  /** Test injection (replay AI). Default: org job client, legacy call shape. */
  aiCall?: AICallFn;
  /** Citation verification on final persist. Default: the org job client. */
  verifyClient?: AIProviderClient;
}

export async function runSuggestThreatsV2(
  args: RunSuggestThreatsV2Args,
): Promise<unknown> {
  const { prisma, data, input, context } = args;
  const startTime = Date.now();

  // --- AI plumbing (legacy-identical call shape: temp 0.3, 45000 tokens) ---
  let aiCall = args.aiCall;
  let verifyClient = args.verifyClient;
  if (!aiCall) {
    const { client } = await createJobAIClient(data.organizationId, prisma);
    aiCall = async (system: string, user: string, stage?: GenerationStage) => {
      // A named stage uses its generation-settings row.
      const settings = generationSettingsFor(stage);
      const resp = await client.complete({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        maxTokens: settings?.maxTokens ?? 45000,
        thinking: settings?.thinking,
      });
      return resp.content;
    };
    verifyClient ??= client;
  }
  // Narrow once for the discovery rounds (set on every branch above).
  const resolvedAiCall = aiCall;

  // --- Pre-steps (ports of the legacy worker block) ---
  const methodologies = input.methodologies ?? ["stride"];
  const categoriesPerComp = categoriesPerComponentFor(methodologies);
  const totalCategoryEvents = Math.max(
    context.components.length * categoriesPerComp,
    1,
  );
  const totalComponents = Math.max(context.components.length, 1);
  const bridge = createProgressBridge(
    prisma,
    data.dbJobId,
    totalComponents,
    totalCategoryEvents,
  );

  if (data.threatModelId) {
    await sweepOrphanThreats(prisma, data.dbJobId, data.threatModelId);
  }
  // A retry-failed run must NOT take the incremental "all clean →
  // skip" / clean-component seeding path — the components it retries may have
  // been marked analyzed by the partial first run. Force a non-incremental
  // resolve so only `input.retryUnits` drive the fan-out (the checkpoint was
  // cleared by the retry-failed route, so step-1 resume is already inert).
  const isRetry = !!input.retryUnits?.length;
  const resume = await resolveResumeState(
    prisma,
    data.dbJobId,
    data.threatModelId,
    context,
    isRetry ? { ...input, fullAnalysis: true } : input,
    categoriesPerComp,
  );
  if (resume.shortCircuit) return resume.shortCircuit;
  bridge.seedCategoriesDone(resume.seededCategories);

  const cancelSignal = { cancelled: false };
  const { consumeCancellation, registerJobAbort } = await import(
    "./ai-worker.js"
  );
  const completedComponentIds = resume.completedComponentIds;
  const options: Partial<MicroAnalysisOptions> = {
    methodologies: input.methodologies,
    minCategoryConfidence: input.minConfidence,
    cancelSignal,
    // Compute the wall-clock deadline ONCE, here at job start, and thread
    // it down. Derived per-unit it would drift and never actually bind. Past it
    // the component loop stops and the run completes with what it has — it does
    // not throw (see services/ai/job-deadline.ts for why that matters).
    deadlineAt: computeDeadlineAt(Date.now()),
    resumeFrom: resume.resumeFrom,
    force: input.force || input.fullAnalysis,
    componentNodeIds: input.componentNodeIds,
    categories: input.categories,
    mitigationsOnly: input.mitigationsOnly ?? false,
    retryUnits: input.retryUnits,
    onCheckpoint: async (componentId, threatsSoFar) => {
      if (consumeCancellation(data.dbJobId)) cancelSignal.cancelled = true;
      completedComponentIds.push(componentId);
      await prisma.aiJob.updateMany({
        where: { id: data.dbJobId },
        data: {
          checkpoint: JSON.stringify({
            completedComponentIds,
            threats: threatsSoFar,
          }),
        },
      });
    },
    onComponentPersisted: bridge.onComponentPersisted,
    onProgress: bridge.onProgress,
  };
  const persist = data.threatModelId
    ? {
        threatModelId: data.threatModelId,
        userId: data.userId,
        // ADR-006 session tag — same value the legacy path uses, so the
        // worker's shared cleanupSessionThreats handler covers this path.
        sessionId: data.dbJobId,
      }
    : undefined;

  // --- Load the seeded pipeline once (shared across discovery rounds) ---
  const pipeline = await loadV2Pipeline(prisma);

  // --- Loop-until-dry discovery (§2.6) ---
  // Each round executes the full pipeline (ThreatIdentifier → … → Verifier);
  // the discovery loop accumulates the post-verifier survivors by ADR-006 key,
  // re-running affected components with an "already found (do not re-propose)"
  // block until a round adds 0 net-new threats or maxRounds is hit. Mode
  // "single" (the seeded default) runs exactly ONE round with the unchanged
  // options object — no extra runs.
  const discovery: DiscoveryConfig = {
    mode: input.discovery?.mode ?? DISCOVERY_DEFAULT.mode,
    maxRounds: input.discovery?.maxRounds ?? DISCOVERY_DEFAULT.maxRounds,
  };

  // Ride-along accumulators (summed across rounds for the final result shape).
  let llmCalls = 0;
  const parseFailures: ParseFailure[] = [];
  let attackChains: AttackChain[] = [];
  let skippedComponentCount = 0;
  let failedUnits: Array<{
    componentId: string;
    category: string;
    error: string;
  }> = [];
  // Challenger-gate summary, accumulated across discovery rounds for the
  // job toast ("N confirmed · M refuted & removed · K uncertain"). Present only
  // when the Verifier stage actually ran in at least one round. Accumulation
  // (documented choice): `refuted` is SUMMED across every round — the total rows
  // removed by this job (each round can delete more). `confirmed`/`uncertain`
  // are taken from the FINAL verifier round's surviving decisions, which is the
  // canonical kept-set after the loop settles (a re-round re-asserts the kept
  // set against the cumulative already-found block). Single mode → exactly the
  // the counts of one round with one verifier.
  let verifierRan = false;
  let confirmedLast = 0;
  let uncertainLast = 0;
  let refutedTotal = 0;

  // cancelJob() aborts this signal, which runPipelineRound hands to every
  // stage as ctx.signal (fan-out, identifier loop) — cancellation is no longer
  // limited to the legacy checkpoint poll.
  const jobAbort = registerJobAbort(data.dbJobId);
  const loop = await runDiscoveryLoop({
    config: discovery,
    report: bridge.onProgress,
    runRound: async ({ round, alreadyFound, affectedComponentIds }) => {
      // Round 1 uses the base options/context unchanged. Re-rounds
      // force re-analysis of the affected components only, carry the cumulative
      // "already found" block (refutedThreats, no reason), and restrict the
      // context to the affected components (mirrors verifier-loop scoping).
      const roundContext =
        round === 1 || !affectedComponentIds?.length
          ? context
          : {
              ...context,
              components: context.components.filter((c) =>
                affectedComponentIds.includes(c.id),
              ),
            };
      const roundOptions: Partial<MicroAnalysisOptions> =
        round === 1
          ? options
          : { ...options, force: true, refutedThreats: alreadyFound };

      const exec = await runPipelineRound(
        {
          prisma,
          aiCall: resolvedAiCall,
          sessionId: data.dbJobId,
          userId: data.userId,
          organizationId: data.organizationId,
          threatModelId: data.threatModelId,
          context: roundContext,
          options: roundOptions,
          persist,
          repairCategories: input.repairCategories === true ? true : undefined,
          signal: jobAbort.signal,
        },
        pipeline,
      );

      llmCalls += exec.llmCalls;
      parseFailures.push(...exec.parseFailures);
      if (round === 1) {
        attackChains = exec.attackChains;
        skippedComponentCount = exec.skippedComponentCount;
        failedUnits = exec.failedUnits;
      }
      // Fold this round's challenger-gate counts in. refuted accumulates
      // (total removed this job); confirmed/uncertain track the LATEST verifier
      // round (canonical kept-set when the loop settles).
      if (exec.verification) {
        verifierRan = true;
        confirmedLast = exec.verification.confirmed;
        uncertainLast = exec.verification.uncertain;
        refutedTotal += exec.verification.refuted;
      }
      return {
        verifiedThreats: exec.finalSet,
        confirmedThreats: exec.confirmedThreats,
        refutedThreats: exec.refutedThreats,
      };
    },
  }).finally(jobAbort.dispose);

  // Surface the challenger-gate outcome in the job summary. Undefined when
  // no round ran the Verifier (non-Verifier paths omit it).
  const verification = verifierRan
    ? {
        confirmed: confirmedLast,
        uncertain: uncertainLast,
        refuted: refutedTotal,
      }
    : undefined;

  // --- Final persist (ADR-006) + summary — legacy result shape ---
  // `loop.finalSet` is the union of every round's survivors, deduped by the
  // ADR-006 key. finalizeV2Run re-persists it and its loser cleanup keeps
  // the DB to exactly this set (the multi-round survivors).
  // A fan-out child failure does NOT fail the parent. The job COMPLETES
  // with `partial: true` + `result.failedUnits`; a retry re-runs ONLY those
  // pairs (input.retryUnits set) on the SAME sessionId, so the loser cleanup
  // must stay scoped to the retried targets — never the whole session.
  // The final mitigation pass runs inside finalizeV2Run on the
  // post-dedup, post-floor set; the MitigationSynthesizer stage only mitigates
  // in mitigations-only mode. Same style wrap the stage used.
  const mitigationAiCall = input.mitigationsOnly
    ? undefined
    : await wrapWithThreatStyle(resolvedAiCall, persist?.userId, "mitigations");

  // Duplicate guard: the same style-wrapped caller the dedup pass uses
  // (SeverityCalibrator stage), asked only about review-band pairs.
  const dedupAiCall = await wrapWithThreatStyle(
    resolvedAiCall,
    persist?.userId,
  );

  return finalizeV2Run({
    prisma,
    context,
    persist,
    verifyClient,
    mitigationAiCall,
    dedupAiCall,
    skipDuplicateGuard: input.mitigationsOnly === true,
    deduped: loop.finalSet,
    attackChains,
    parseFailures,
    methodologies,
    llmCalls,
    skippedComponentCount,
    startTime,
    dirtyComponentDbIds: resume.dirtyComponentDbIds,
    failedUnits,
    retryUnits: input.retryUnits,
    verification,
    report: bridge.onProgress,
  });
}
