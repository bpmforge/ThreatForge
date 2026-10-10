/**
 * Agentic analysis via the `agentic-analysis-v2` pipeline definition.
 *
 * Flag-on (`agent-chain-v2`) replacement for the legacy runAgenticAnalysis
 * call in ai-worker.ts. Each methodology (STRIDE / PASTA / Kill Chain / MITRE
 * ATT&CK, plus conditional supply-chain / ML) runs as its own seeded
 * PipelineStage backed by a prompt template. The verify loop is driven
 * directly by this orchestrator (the Verifier stage row is seeded optional).
 *
 * Every prompt is the exact legacy (system, user) pair and every transform is
 * the same shared helper the legacy path uses, so the returned
 * AgenticAnalysisResult is byte-identical to the legacy output for the same
 * fixture + journal. It has the same shape the worker stores as AiJob.result;
 * no Threat rows are persisted on this path.
 */
import type { PrismaClient } from "@prisma/client";
import type { AICallFn } from "./micro-analysis/types.js";
import type { ThreatModelContext } from "../../types/ai.js";
import type { ExtractionResult } from "./extraction-agent.js";
import logger from "../../utils/logger.js";
import {
  createStageRunner,
  markExecutionCompleted,
  markExecutionFailed,
} from "./pipeline-execution-runner.js";
import {
  AGENTIC_PIPELINE_NAME,
  AGENTIC_STAGE_NAMES,
  AGENTIC_VERIFY_STAGE_NAME,
  AGENTIC_MAX_LOOPS,
  applyVerification,
  buildFrameworkPrompt,
  buildVerificationPrompt,
  consolidateAgentic,
  parseThreats,
  parseVerificationResult,
  selectFrameworks,
  type AgenticAnalysisResult,
  type AgenticFramework,
  type AgenticThreat,
} from "./agentic-analysis.js";

export interface RunAgenticAnalysisV2Args {
  prisma: PrismaClient;
  context: ThreatModelContext;
  userId: string;
  organizationId: string;
  threatModelId?: string;
  /** (systemPrompt, userPrompt) => completion — same shape as the legacy runners. */
  aiCall: AICallFn;
  /** Explicit framework list (else auto-selected, exactly as legacy does). */
  frameworks?: AgenticFramework[];
  /** Min confidence to stop the verify loop (0-100). Default 85, legacy parity. */
  minConfidence?: number;
  /** Max verify loops. Default 2, legacy parity. */
  maxLoops?: number;
  /** Extraction (supply-chain / ML runners). */
  extraction?: ExtractionResult;
  onProgress?: (stage: string, status: string) => void;
}

export async function runAgenticAnalysisV2(
  args: RunAgenticAnalysisV2Args,
): Promise<AgenticAnalysisResult> {
  const {
    prisma,
    context,
    userId,
    organizationId,
    threatModelId,
    aiCall,
    extraction,
  } = args;
  const startTime = Date.now();
  const minConfidence = args.minConfidence ?? 85;
  const maxLoops = args.maxLoops ?? AGENTIC_MAX_LOOPS;

  const report = (stage: string, status: string) => {
    logger.info({ stage, status }, "Agentic analysis v2 stage");
    args.onProgress?.(stage, status);
  };

  // Same selection legacy uses → identical framework set + order for the fixture.
  const frameworks = args.frameworks ?? selectFrameworks(context, extraction);

  // --- Locate the seeded pipeline + its stage rows (for execution records) ---
  const pipeline = await prisma.promptPipeline.findFirst({
    where: {
      name: AGENTIC_PIPELINE_NAME,
      isBuiltIn: true,
      organizationId: null,
    },
    select: { id: true, stages: { orderBy: { order: "asc" } } },
  });
  if (!pipeline) {
    throw new Error(
      `agent-chain-v2 is enabled but the "${AGENTIC_PIPELINE_NAME}" pipeline ` +
        "is not seeded — run `npm run seed:pipelines` first",
    );
  }
  const stageByName = new Map(pipeline.stages.map((s) => [s.name, s]));

  // --- PipelineExecution row (execution visibility) ---
  const execution = await prisma.pipelineExecution.create({
    data: {
      pipelineId: pipeline.id,
      userId,
      organizationId,
      threatModelId: threatModelId ?? null,
      inputMetadata: JSON.stringify({
        mode: "agentic",
        frameworks,
      }),
      status: "RUNNING",
    },
  });

  const runStage = createStageRunner({
    prisma,
    executionId: execution.id,
    stageByName,
    aiCall,
    reviewerStageName: AGENTIC_VERIFY_STAGE_NAME,
  });

  let finalStatus: "COMPLETED" | "FAILED" = "COMPLETED";
  try {
    // --- Phase 1: framework runner stages (one per methodology) ---
    const allThreats: AgenticThreat[] = [];
    const frameworkResults: Record<
      string,
      { threats: number; duration: number }
    > = {};

    for (const framework of frameworks) {
      const stageName = AGENTIC_STAGE_NAMES[framework];
      const fwStart = Date.now();
      report(stageName, "running");

      const prompt = buildFrameworkPrompt(framework, context, extraction);
      let threats: AgenticThreat[] = [];
      if (prompt) {
        // Legacy parses the raw runner output even on failure (parseThreats
        // returns [] for the "Error in …" sentinel) — same behavior here.
        const raw = await runStage(stageName, prompt.system, prompt.user);
        threats = parseThreats(raw, framework);
      }
      const duration = Date.now() - fwStart;
      frameworkResults[framework] = { threats: threats.length, duration };
      allThreats.push(...threats);
      report(stageName, `complete (${threats.length})`);
    }

    // --- Phase 2: verification loop (maps to the Verifier stage slot) ---
    let finalThreats = allThreats;
    let verificationLoops = 0;
    let confidenceScore = 0;

    for (let loop = 0; loop < maxLoops; loop++) {
      verificationLoops++;
      report(AGENTIC_VERIFY_STAGE_NAME, `running (loop ${loop + 1})`);
      const { system, user } = buildVerificationPrompt(context, finalThreats);
      const raw = await runStage(AGENTIC_VERIFY_STAGE_NAME, system, user);
      const verification = parseVerificationResult(raw);
      confidenceScore = verification.overallScore;
      finalThreats = applyVerification(finalThreats, verification);
      report(
        AGENTIC_VERIFY_STAGE_NAME,
        `complete (score ${confidenceScore}, ${verification.missing.length} gaps)`,
      );
      if (
        confidenceScore >= minConfidence &&
        verification.missing.length === 0
      ) {
        break;
      }
    }

    // --- Phase 3: consolidation (shared helper — identical to legacy) ---
    const result = consolidateAgentic(
      finalThreats,
      context,
      frameworks,
      confidenceScore,
      verificationLoops,
      frameworkResults,
      startTime,
    );

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
      "Agentic analysis v2 execution finished",
    );
  }
}
