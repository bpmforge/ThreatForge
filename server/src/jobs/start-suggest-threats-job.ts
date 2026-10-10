/**
 * Start a SUGGEST_THREATS analysis as a tracked background job and answer
 * 202 with its id. Every analysis entry point goes through here so none of
 * them can run the analysis inside the HTTP request or skip the org's spend
 * cap: BullMQ when Redis is configured, the in-process runner otherwise (or
 * when the enqueue fails).
 */
import type { FastifyReply, FastifyBaseLogger } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { replyIfOverSpendCap } from "../services/ai/spend-guard.js";
import type { AiJobData } from "./ai-queue.js";
import { createSuggestThreatsJob } from "./create-suggest-threats-job.js";

export interface StartSuggestThreatsJobArgs {
  prisma: PrismaClient;
  reply: FastifyReply;
  log: FastifyBaseLogger;
  userId: string;
  organizationId: string;
  threatModelId: string;
  /** Job input JSON (carries the analysis `mode`). */
  input: string;
  /** Label returned to the client, e.g. "EXPERT_ANALYSIS". */
  type: string;
  estimatedDuration: string;
}

/**
 * Hand a freshly created AiJob row to the worker: BullMQ when Redis is
 * configured, the in-process runner otherwise (or when the enqueue fails).
 */
export async function dispatchAiJob(
  jobData: AiJobData,
  log: FastifyBaseLogger,
): Promise<void> {
  const { enqueueAiJob, runJobInBackground } = await import("./ai-queue.js");
  if (process.env.REDIS_URL) {
    await enqueueAiJob(jobData).catch((err) => {
      log.warn({ err }, "BullMQ enqueue failed, using in-process runner");
      runJobInBackground(jobData);
    });
  } else {
    runJobInBackground(jobData);
  }
}

export async function startSuggestThreatsJob(
  args: StartSuggestThreatsJobArgs,
): Promise<FastifyReply> {
  const { prisma, reply, log, userId, organizationId, threatModelId, input } =
    args;

  if (await replyIfOverSpendCap(reply, prisma, organizationId)) return reply;

  const result = await createSuggestThreatsJob({
    prisma,
    userId,
    organizationId,
    threatModelId,
    input,
  });
  if (result.conflict) {
    return reply.status(409).send({
      error: "Threat analysis already in progress for this model",
      existingJobId: result.existingJobId,
    });
  }
  const job = result.job!;

  const jobData = {
    type: "SUGGEST_THREATS" as const,
    userId,
    organizationId,
    threatModelId,
    input,
    dbJobId: job.id,
  };
  await dispatchAiJob(jobData, log);

  return reply.status(202).send({
    data: {
      jobId: job.id,
      status: "QUEUED",
      type: args.type,
      statusUrl: `/api/ai-jobs/${job.id}`,
      estimatedDuration: args.estimatedDuration,
    },
  });
}
