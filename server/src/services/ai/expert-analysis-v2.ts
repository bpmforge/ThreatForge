/**
 * Expert analysis via the `expert-analysis-v2` pipeline definition.
 *
 * Flag-on (`agent-chain-v2`) replacement for the legacy runExpertAnalysis call
 * in ai-worker.ts. The 5 LLM passes are seeded PipelineStage rows backed by
 * prompt templates (the verbatim PASS_N constants); the last pass is the
 * code-only Consolidate stage. This orchestrator drives those stages and
 * records the run in PipelineExecution + PipelineStageExecution rows.
 *
 * Every prompt is the exact legacy system prompt plus the exact legacy
 * inter-pass hand-off string, and every threat transform is the same shared
 * helper the legacy path uses, so the returned ExpertAnalysisResult is
 * byte-identical to the legacy output for the same fixture + journal. It has
 * the same shape the worker stores as AiJob.result; no Threat rows are
 * persisted on this path.
 */
import type { PrismaClient } from "@prisma/client";
import type { AICallFn } from "./micro-analysis/types.js";
import type { ThreatModelContext } from "../../types/ai.js";
import logger from "../../utils/logger.js";
import {
  createStageRunner,
  markExecutionCompleted,
  markExecutionFailed,
} from "./pipeline-execution-runner.js";
import {
  applyExpertVerification,
  buildPass2Input,
  buildPass3Input,
  buildPass4Input,
  buildPass5Input,
  consolidateExpertThreats,
  EXPERT_PASS_PROMPTS,
  EXPERT_PASS_TEMPLATE_IDS,
  EXPERT_PIPELINE_NAME,
  formatContext,
  MAX_VERIFICATION_LOOPS,
  parseThreatsJson,
  type ExpertAnalysisResult,
  type ExpertThreat,
} from "./expert-analysis.js";

export interface RunExpertAnalysisV2Args {
  prisma: PrismaClient;
  context: ThreatModelContext;
  userId: string;
  organizationId: string;
  threatModelId?: string;
  /** (systemPrompt, userPrompt) => completion — same shape as the legacy runPass. */
  aiCall: AICallFn;
  onProgress?: (pass: number, name: string, status: string) => void;
}

/** Resolve the seeded expert pass system prompts from the DB, falling back to
 *  the in-code constants (the seed sources them from the same constants, so
 *  these are byte-identical; the DB read keeps the template the source of
 *  record while staying output-identical if a template row is missing). */
async function loadPassSystemPrompts(
  prisma: PrismaClient,
): Promise<Record<keyof typeof EXPERT_PASS_TEMPLATE_IDS, string>> {
  const ids = Object.values(EXPERT_PASS_TEMPLATE_IDS);
  const rows = await prisma.promptTemplate.findMany({
    where: { id: { in: ids } },
    select: { id: true, systemPrompt: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r.systemPrompt]));
  return {
    pass1:
      byId.get(EXPERT_PASS_TEMPLATE_IDS.pass1) ??
      EXPERT_PASS_PROMPTS.PASS_1_UNDERSTAND,
    pass2:
      byId.get(EXPERT_PASS_TEMPLATE_IDS.pass2) ??
      EXPERT_PASS_PROMPTS.PASS_2_FLOWS,
    pass3:
      byId.get(EXPERT_PASS_TEMPLATE_IDS.pass3) ??
      EXPERT_PASS_PROMPTS.PASS_3_THREATS,
    pass4:
      byId.get(EXPERT_PASS_TEMPLATE_IDS.pass4) ??
      EXPERT_PASS_PROMPTS.PASS_4_CHAINS,
    pass5:
      byId.get(EXPERT_PASS_TEMPLATE_IDS.pass5) ??
      EXPERT_PASS_PROMPTS.PASS_5_VERIFY,
  };
}

export async function runExpertAnalysisV2(
  args: RunExpertAnalysisV2Args,
): Promise<ExpertAnalysisResult> {
  const { prisma, context, userId, organizationId, threatModelId, aiCall } =
    args;
  const startTime = Date.now();
  let verificationLoops = 0;

  const report = (pass: number, name: string, status: string) => {
    logger.info({ pass, name, status }, "Expert analysis v2 pass");
    args.onProgress?.(pass, name, status);
  };

  // --- Locate the seeded pipeline + its stage rows (for execution records) ---
  const pipeline = await prisma.promptPipeline.findFirst({
    where: {
      name: EXPERT_PIPELINE_NAME,
      isBuiltIn: true,
      organizationId: null,
    },
    select: { id: true, stages: { orderBy: { order: "asc" } } },
  });
  if (!pipeline) {
    throw new Error(
      `agent-chain-v2 is enabled but the "${EXPERT_PIPELINE_NAME}" pipeline ` +
        "is not seeded — run `npm run seed:pipelines` first",
    );
  }
  const stageByName = new Map(pipeline.stages.map((s) => [s.name, s]));
  const systemPrompts = await loadPassSystemPrompts(prisma);

  // --- PipelineExecution row (makes the run visible) ---
  const execution = await prisma.pipelineExecution.create({
    data: {
      pipelineId: pipeline.id,
      userId,
      organizationId,
      threatModelId: threatModelId ?? null,
      inputMetadata: JSON.stringify({ mode: "expert" }),
      status: "RUNNING",
    },
  });

  const runStage = createStageRunner({
    prisma,
    executionId: execution.id,
    stageByName,
    aiCall,
    reviewerStageName: "Verify",
  });

  /** Record a code-only stage execution (Consolidate). */
  const runCodeStage = async (
    stageName: string,
    output: unknown,
    durationMs: number,
  ): Promise<void> => {
    const stage = stageByName.get(stageName);
    if (!stage) return;
    const row = {
      status: "COMPLETED" as const,
      startedAt: new Date(Date.now() - durationMs),
      output: JSON.stringify(output).slice(0, 10_000),
      durationMs,
      completedAt: new Date(),
    };
    await prisma.pipelineStageExecution.upsert({
      where: {
        pipelineExecutionId_stageId: {
          pipelineExecutionId: execution.id,
          stageId: stage.id,
        },
      },
      update: row,
      create: {
        pipelineExecutionId: execution.id,
        stageId: stage.id,
        order: stage.order,
        ...row,
      },
    });
  };

  let finalStatus: "COMPLETED" | "FAILED" = "COMPLETED";
  try {
    const archContext = formatContext(context);

    // --- Pass 1: Understand ---
    report(1, "Understand Architecture", "running");
    const pass1 = await runStage(
      "Understand",
      systemPrompts.pass1,
      archContext,
    );
    report(1, "Understand Architecture", "complete");

    // --- Pass 2: Analyze Flows ---
    report(2, "Analyze Data Flows", "running");
    const pass2 = await runStage(
      "DataFlows",
      systemPrompts.pass2,
      buildPass2Input(archContext, pass1),
    );
    report(2, "Analyze Data Flows", "complete");

    // --- Pass 3: Identify Threats ---
    report(3, "Identify Threats", "running");
    const pass3Raw = await runStage(
      "IdentifyThreats",
      systemPrompts.pass3,
      buildPass3Input(archContext, pass1, pass2),
    );
    const threats = parseThreatsJson(pass3Raw);
    report(3, "Identify Threats", `complete (${threats.length} found)`);

    // --- Pass 4: Attack Chains ---
    report(4, "Trace Attack Chains", "running");
    const pass4Raw = await runStage(
      "AttackChains",
      systemPrompts.pass4,
      buildPass4Input(archContext, threats),
    );
    const chainThreats = parseThreatsJson(pass4Raw);
    report(
      4,
      "Trace Attack Chains",
      `complete (${chainThreats.length} chains)`,
    );

    let allThreats: ExpertThreat[] = [...threats, ...chainThreats];

    // --- Pass 5: Verify (with loop) ---
    for (let loop = 0; loop < MAX_VERIFICATION_LOOPS; loop++) {
      verificationLoops++;
      report(5, `Verify (loop ${loop + 1})`, "running");
      const pass5Raw = await runStage(
        "Verify",
        systemPrompts.pass5,
        buildPass5Input(archContext, pass1, pass2, allThreats),
      );
      const applied = applyExpertVerification(allThreats, pass5Raw);
      allThreats = applied.threats;
      report(5, `Verify (loop ${loop + 1})`, applied.summary);
      if (applied.done) break;
    }

    // --- Pass 6: Consolidate (code-only) ---
    report(6, "Consolidate", "running");
    const consolidateStart = Date.now();
    const deduped = consolidateExpertThreats(allThreats);
    const strideCoverage = [...new Set(deduped.map((t) => t.category))];
    const analysisTypes = [...new Set(deduped.map((t) => t.analysisType))];
    await runCodeStage(
      "Consolidate",
      { count: deduped.length },
      Date.now() - consolidateStart,
    );
    report(
      6,
      "Consolidate",
      `final: ${deduped.length} threats, ${strideCoverage.length}/6 STRIDE`,
    );

    const result: ExpertAnalysisResult = {
      threats: deduped,
      summary: {
        totalThreats: deduped.length,
        strideCoverage,
        analysisTypes,
        // 5 LLM passes + verify loops + consolidate, mirroring the legacy
        // passesCompleted counter (Pass1,2,3,4 + N verify outputs).
        passesCompleted: 4 + verificationLoops,
        verificationLoops,
        duration: Date.now() - startTime,
      },
      architectureUnderstanding: pass1,
      dataFlowFindings: pass2,
      attackChains: pass4Raw,
    };

    await markExecutionCompleted(
      prisma,
      execution.id,
      result.summary.totalThreats,
      startTime,
    );
    return result;
  } catch (err) {
    finalStatus = "FAILED";
    await markExecutionFailed(prisma, execution.id, err, startTime);
    throw err;
  } finally {
    logger.info(
      { executionId: execution.id, status: finalStatus },
      "Expert analysis v2 execution finished",
    );
  }
}
