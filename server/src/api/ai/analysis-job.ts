/**
 * Shared entry for the expert and agentic analysis routes: check the model
 * has content to analyze, then start its tracked SUGGEST_THREATS job.
 */
import type { FastifyBaseLogger, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { buildThreatModelContext } from "./helpers.js";
import { sendBadRequest, sendNotFound } from "../../utils/api-response.js";
import { startSuggestThreatsJob } from "../../jobs/start-suggest-threats-job.js";

/**
 * Validate that a model has something to analyze, then start its
 * SUGGEST_THREATS background job (202 with the job id).
 * `analysisName` completes the "before running ..." hint, e.g. "expert analysis".
 */
export async function startModelAnalysisJob(args: {
  prisma: PrismaClient;
  reply: FastifyReply;
  log: FastifyBaseLogger;
  userId: string;
  modelId: string;
  analysisName: string;
  input: string;
  type: string;
  estimatedDuration: string;
}): Promise<FastifyReply> {
  const { prisma, reply, modelId } = args;

  const context = await buildThreatModelContext(modelId);
  if (!context) {
    return sendNotFound(reply, "Threat model");
  }

  if (context.components.length === 0 && context.connections.length === 0) {
    return sendBadRequest(
      reply,
      `Add components and data flows before running ${args.analysisName}.`,
    );
  }

  const model = await prisma.threatModel.findUnique({
    where: { id: modelId },
    select: { project: { select: { organizationId: true } } },
  });
  if (!model) return sendNotFound(reply, "Threat model");

  return startSuggestThreatsJob({
    prisma,
    reply,
    log: args.log,
    userId: args.userId,
    organizationId: model.project.organizationId,
    threatModelId: modelId,
    input: args.input,
    type: args.type,
    estimatedDuration: args.estimatedDuration,
  });
}
