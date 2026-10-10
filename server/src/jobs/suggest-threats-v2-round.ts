/**
 * SUGGEST_THREATS v2 — one pipeline round (factored out of the runner).
 *
 * Executes the seeded `threat-analysis-v2` pipeline ONCE and collects the
 * stage outputs the runner needs: the Verifier final set (CONFIRMED +
 * UNCERTAIN survivors), the subset the Verifier labelled CONFIRMED, and the
 * ride-alongs (attackChains, llmCalls, parseFailures, fan-out failedUnits,
 * skippedComponentCount). The runner runs it once per job;
 * the loop-until-dry path (suggest-threats-v2-discovery.ts) calls it per round
 * with a per-round `options` overlay (force + the "already found" refutedThreats
 * block) and a context filtered to the affected components.
 *
 * Failure handling (cancellation contract) is unchanged: the first FAILED
 * non-optional stage is surfaced as the job error, with "Analysis cancelled by
 * user" carrying code CANCELLED.
 */
import type { PrismaClient } from "@prisma/client";
import type { ThreatModelContext } from "../types/ai.js";
import type { AIService } from "../services/ai/ai-service.js";
import type {
  AICallFn,
  MicroAnalysisOptions,
  MicroThreat,
  ParseFailure,
} from "../services/ai/micro-analysis/types.js";
import type { AttackChain } from "../services/threat-generation/attack-chain-analyzer.js";
import { threatRefOf } from "../services/ai/stages/verifier-checks.js";

const THREAT_ANALYSIS_V2_PIPELINE = "threat-analysis-v2";

interface StageOutputs {
  threats?: MicroThreat[];
  parseFailures?: ParseFailure[];
  attackChains?: AttackChain[];
  llmCalls?: number;
  skippedComponentCount?: number;
  calibratedThreats?: MicroThreat[];
  verifiedThreats?: MicroThreat[];
  refutedThreats?: Array<{ threat: MicroThreat; reason?: string }>;
  decisions?: Array<{
    threatRef: string;
    challengeStatus: "CONFIRMED" | "UNCERTAIN";
  }>;
  /** Verifier stage — refuted-by-LLM rows deleted this round. */
  deletedCount?: number;
  /** Verifier stage — topology-impossible rows removed without an LLM call. */
  topologyRefutedCount?: number;
  failedUnits?: Array<{ componentId: string; category: string; error: string }>;
  fanOutUnitCount?: number;
}

export interface RoundExecResult {
  /** Verifier survivors (CONFIRMED + UNCERTAIN), or calibrated set if no Verifier. */
  finalSet: MicroThreat[];
  /** Of `finalSet`, those the Verifier labelled CONFIRMED (drives the loop trigger). */
  confirmedThreats: MicroThreat[];
  /** Threats the Verifier refuted this round, with the refutation reason. */
  refutedThreats: Array<{ threat: MicroThreat; reason?: string }>;
  attackChains: AttackChain[];
  llmCalls: number;
  parseFailures: ParseFailure[];
  skippedComponentCount: number;
  failedUnits: Array<{ componentId: string; category: string; error: string }>;
  /**
   * Challenger-gate summary for THIS round, present only when the Verifier
   * stage ran (optional/absent → undefined). The runner accumulates these across
   * discovery rounds into the job-level `verification` toast counts:
   * - confirmed/uncertain come from this round's surviving Verifier decisions;
   * - refuted is the rows removed this round (LLM-refuted + topology-impossible).
   * The runner sums `refuted` across all rounds (total removed this job) and
   * takes confirmed/uncertain from the FINAL round's kept-set.
   */
  verification?: { confirmed: number; uncertain: number; refuted: number };
}

export interface RunPipelineRoundArgs {
  prisma: PrismaClient;
  aiCall: AICallFn;
  sessionId: string;
  userId: string;
  organizationId: string;
  threatModelId?: string;
  context: ThreatModelContext;
  options: Partial<MicroAnalysisOptions>;
  persist?: { threatModelId: string; userId: string; sessionId?: string };
  repairCategories?: boolean;
  /** The job's cancel signal, threaded to every stage as `ctx.signal`. */
  signal?: AbortSignal;
  /**
   * Resume: reuse this PipelineExecution.id so the stage-boundary cache
   * serves the stages/units that completed before the job was interrupted.
   * Read from `AiJob.checkpoint.executionId` by the runner on a re-enqueue.
   */
  resumeExecutionId?: string;
  /**
   * Sink for the executionId the pipeline used this round, so the runner
   * can persist it to `AiJob.checkpoint` for a future resume. Called once with
   * key "executionId".
   */
  onCheckpoint?: <T>(key: string, value: T) => Promise<void>;
}

/** Look up the seeded pipeline once (id + stage optionality for the failure scan). */
export async function loadV2Pipeline(prisma: PrismaClient): Promise<{
  id: string;
  stages: Array<{ id: string; optional: boolean }>;
}> {
  const pipeline = await prisma.promptPipeline.findFirst({
    where: {
      name: THREAT_ANALYSIS_V2_PIPELINE,
      isBuiltIn: true,
      organizationId: null,
      isActive: true,
    },
    select: { id: true, stages: { select: { id: true, optional: true } } },
  });
  if (!pipeline) {
    throw new Error(
      `agent-chain-v2 is enabled but the "${THREAT_ANALYSIS_V2_PIPELINE}" ` +
        "pipeline is not seeded — run `npm run seed:pipelines` first",
    );
  }
  return pipeline;
}

/** Execute the seeded pipeline once and collect the runner-facing outputs. */
export async function runPipelineRound(
  args: RunPipelineRoundArgs,
  pipeline: { id: string; stages: Array<{ id: string; optional: boolean }> },
): Promise<RoundExecResult> {
  const { aiCall, sessionId, context, options, persist } = args;

  const { registerStageHandlers } = await import(
    "../services/ai/stages/index.js"
  );
  registerStageHandlers();
  const { executePipeline } = await import(
    "../services/ai/pipeline-service.js"
  );

  const aiServiceGuard = {
    complete: async () => {
      throw new Error(
        "threat-analysis-v2 stages are handler-backed — the AIService prompt path must not be used",
      );
    },
  } as unknown as AIService;

  const result = await executePipeline(
    {
      pipelineId: pipeline.id,
      userId: args.userId,
      organizationId: args.organizationId,
      threatModelId: args.threatModelId,
      resumeExecutionId: args.resumeExecutionId,
      inputMetadata: {
        context,
        options,
        persist,
        repairCategories: args.repairCategories === true ? true : undefined,
        // Re-runs share this: the Verifier and the discovery
        // loop both re-run ThreatIdentifier with the same raw-context
        // inputs so methodology + session + dedup are identical to the main run.
        identifierInputs: { context, options, persist },
      },
    },
    aiServiceGuard,
    {
      aiCall,
      sessionId,
      signal: args.signal,
      progress: async () => undefined,
      // pipeline-service calls this once with ("executionId", id) so the
      // runner can persist it for resume. Defaults to a no-op.
      checkpoint: args.onCheckpoint ?? (async () => undefined),
    },
  );

  // Failure scan — first FAILED non-optional stage becomes the job error.
  const optionalById = new Map(pipeline.stages.map((s) => [s.id, s.optional]));
  const failed = result.stageResults.find(
    (s) => s.status === "FAILED" && !optionalById.get(s.stageId),
  );
  if (failed || result.status === "FAILED") {
    const message =
      failed?.error ??
      result.error?.message ??
      "threat-analysis-v2 pipeline failed";
    const err = new Error(message);
    if (message === "Analysis cancelled by user") {
      (err as Error & { code?: string }).code = "CANCELLED";
    }
    throw err;
  }

  const outputByName = new Map<string, StageOutputs>(
    result.stageResults
      .filter((s) => s.status === "COMPLETED" && s.output)
      .map((s) => [s.stageName, s.output as StageOutputs]),
  );
  const identifier = outputByName.get("ThreatIdentifier");
  const calibrator = outputByName.get("SeverityCalibrator");
  if (!calibrator?.calibratedThreats) {
    throw new Error(
      "threat-analysis-v2 completed without SeverityCalibrator output",
    );
  }
  const verifier = outputByName.get("Verifier");
  const finalSet = verifier?.verifiedThreats ?? calibrator.calibratedThreats;

  // CONFIRMED subset: when the Verifier ran, intersect its CONFIRMED decisions
  // with the surviving set by ADR-006 key. No Verifier (skipped) → treat every
  // survivor as confirmed so the loop trigger still fires for non-STRIDE paths.
  const confirmedRefs = verifier?.decisions
    ? new Set(
        verifier.decisions
          .filter((d) => d.challengeStatus === "CONFIRMED")
          .map((d) => d.threatRef),
      )
    : null;
  const confirmedThreats = confirmedRefs
    ? finalSet.filter((t) => confirmedRefs.has(threatRefOf(t)))
    : finalSet;

  // Per-round challenger-gate counts (only when the Verifier ran). The
  // runner folds these into the job-level `verification` toast. confirmed/
  // uncertain come from this round's surviving decisions; refuted is the rows
  // removed this round (LLM-refuted + topology-impossible).
  const verification = verifier
    ? {
        confirmed: (verifier.decisions ?? []).filter(
          (d) => d.challengeStatus === "CONFIRMED",
        ).length,
        uncertain: (verifier.decisions ?? []).filter(
          (d) => d.challengeStatus === "UNCERTAIN",
        ).length,
        // deletedCount alone: `deleteKeys` already contains the
        // topology-refuted refs — applyPass deletes them through the same call —
        // so adding topologyRefutedCount would count every topology refutation
        // twice.
        refuted: verifier.deletedCount ?? 0,
      }
    : undefined;

  let llmCalls = 0;
  const parseFailures: ParseFailure[] = [];
  for (const out of outputByName.values()) {
    llmCalls += out.llmCalls ?? 0;
    parseFailures.push(...(out.parseFailures ?? []));
  }

  return {
    finalSet,
    confirmedThreats,
    refutedThreats: verifier?.refutedThreats ?? [],
    attackChains: identifier?.attackChains ?? [],
    llmCalls,
    parseFailures,
    skippedComponentCount: identifier?.skippedComponentCount ?? 0,
    failedUnits: identifier?.failedUnits ?? [],
    verification,
  };
}
