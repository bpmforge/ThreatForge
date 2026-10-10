/**
 * Shared PipelineExecution bookkeeping for the v2 pipeline orchestrators
 * (agentic-analysis-v2, expert-analysis-v2): per-stage execution rows plus the
 * terminal COMPLETED / FAILED update on the PipelineExecution row.
 */
import type { PrismaClient } from "@prisma/client";
import type { AICallFn } from "./micro-analysis/types.js";

interface PipelineStageRef {
  id: string;
  order: number;
}

/**
 * Build `runStage`: write its PipelineStageExecution row, call aiCall, return raw.
 * The stage named `reviewerStageName` is routed to the "reviewer" model role.
 */
export function createStageRunner(args: {
  prisma: PrismaClient;
  executionId: string;
  stageByName: Map<string, PipelineStageRef>;
  aiCall: AICallFn;
  reviewerStageName: string;
}): (
  stageName: string,
  systemPrompt: string,
  userContent: string,
) => Promise<string> {
  const { prisma, executionId, stageByName, aiCall, reviewerStageName } = args;
  return async (stageName, systemPrompt, userContent) => {
    const stage = stageByName.get(stageName);
    const stageExecStart = Date.now();
    if (stage) {
      await prisma.pipelineExecution.update({
        where: { id: executionId },
        data: { currentStageId: stage.id },
      });
    }

    let raw: string;
    let failed: string | undefined;
    try {
      raw = await aiCall(
        systemPrompt,
        userContent,
        stageName === reviewerStageName ? "reviewer" : "analysis",
      );
    } catch (err) {
      failed = err instanceof Error ? err.message : "unknown";
      raw = `Error in ${stageName}: ${failed}`;
    }

    if (stage) {
      // upsert on (executionId, stageId): the Verify stage is re-entered once
      // per verification loop, so the second iteration updates its row rather
      // than violating the unique constraint.
      const row = {
        status: (failed ? "FAILED" : "COMPLETED") as "FAILED" | "COMPLETED",
        input: userContent.slice(0, 10_000),
        output: raw.slice(0, 10_000),
        durationMs: Date.now() - stageExecStart,
        errorMessage: failed,
        completedAt: new Date(),
      };
      await prisma.pipelineStageExecution.upsert({
        where: {
          pipelineExecutionId_stageId: {
            pipelineExecutionId: executionId,
            stageId: stage.id,
          },
        },
        update: row,
        create: {
          pipelineExecutionId: executionId,
          stageId: stage.id,
          order: stage.order,
          startedAt: new Date(stageExecStart),
          ...row,
        },
      });
    }
    return raw;
  };
}

/** Mark the PipelineExecution COMPLETED with its threat total. */
export async function markExecutionCompleted(
  prisma: PrismaClient,
  executionId: string,
  totalThreats: number,
  startTime: number,
): Promise<void> {
  await prisma.pipelineExecution.update({
    where: { id: executionId },
    data: {
      status: "COMPLETED",
      finalResult: JSON.stringify({ totalThreats }),
      totalDurationMs: Date.now() - startTime,
      completedAt: new Date(),
      currentStageId: null,
    },
  });
}

/** Mark the PipelineExecution FAILED with the error message. */
export async function markExecutionFailed(
  prisma: PrismaClient,
  executionId: string,
  err: unknown,
  startTime: number,
): Promise<void> {
  await prisma.pipelineExecution.update({
    where: { id: executionId },
    data: {
      status: "FAILED",
      errorMessage: err instanceof Error ? err.message : "unknown",
      totalDurationMs: Date.now() - startTime,
      completedAt: new Date(),
      currentStageId: null,
    },
  });
}
