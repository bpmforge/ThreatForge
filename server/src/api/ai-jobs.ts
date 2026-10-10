/**
 * AI Jobs API Routes
 *
 * Provides endpoints for managing async AI jobs:
 *   GET  /api/ai-jobs         - List user's jobs (filterable, paginated)
 *   GET  /api/ai-jobs/:jobId  - Get job status + result
 *   DELETE /api/ai-jobs/:jobId - Cancel a QUEUED job
 */
import { replyIfOverSpendCap } from "../services/ai/spend-guard.js";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { getPrisma } from "../db.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import {
  canPerformAction,
  isActiveOrgMember,
} from "../services/access-control/access-control-service.js";
import {
  sendSuccess,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
  sendList,
  parsePagination,
} from "../utils/api-response.js";
import { routeAuthz } from "../middleware/authz-policy.js";

/** True unless the job is tied to a model the owner can no longer edit. */
async function canStillEdit(
  userId: string,
  job: { threatModelId: string | null },
): Promise<boolean> {
  if (!job.threatModelId) return true;
  return (await canPerformAction(userId, job.threatModelId, "edit")).allowed;
}

const EDIT_LOST = "You no longer have edit access to this job's threat model";

/**
 * The caller's own job, if they may still re-run it: re-running spends the
 * org's AI budget and writes to the model, so they must still be an active
 * member with edit access. Replies with the error and returns null otherwise.
 */
async function loadRerunnableJob(
  request: FastifyRequest<{ Params: { jobId: string } }>,
  reply: FastifyReply,
) {
  const user = getAuthUser(request);
  const prisma = await getPrisma();
  const job = await prisma.aiJob.findUnique({
    where: { id: request.params.jobId },
  });
  if (!job) {
    await sendNotFound(reply, "AI job", request.params.jobId);
  } else if (job.userId !== user.id) {
    await sendForbidden(reply, "You do not have access to this job");
  } else if (!(await isActiveOrgMember(user.id, job.organizationId))) {
    await sendForbidden(
      reply,
      "You are no longer a member of this job's organization",
    );
  } else if (!(await canStillEdit(user.id, job))) {
    await sendForbidden(reply, EDIT_LOST);
  } else {
    return job;
  }
  return null;
}

/** Re-run a job under its SAME id: the queue when Redis is up, else in process. */
async function requeueJob(
  job: {
    id: string;
    type: string;
    userId: string;
    organizationId: string;
    threatModelId: string | null;
  },
  input: string,
): Promise<void> {
  const { enqueueAiJob, runJobInBackground } = await import(
    "../jobs/ai-queue.js"
  );
  const jobData = {
    type: job.type as import("../jobs/ai-queue.js").AiJobType,
    userId: job.userId,
    organizationId: job.organizationId,
    threatModelId: job.threatModelId ?? undefined,
    input,
    dbJobId: job.id,
  };
  if (process.env.REDIS_URL) {
    await enqueueAiJob(jobData).catch(() => runJobInBackground(jobData));
  } else {
    runJobInBackground(jobData);
  }
}

export const aiJobRoutes: FastifyPluginAsync = async (server) => {
  /** GET /api/ai-jobs - List user's AI jobs */
  server.get<{
    Querystring: {
      page?: string;
      limit?: string;
      status?: string;
      type?: string;
      threatModelId?: string;
    };
  }>("/api/ai-jobs", routeAuthz("authenticated"), async (request, reply) => {
    const user = getAuthUser(request);
    const prisma = await getPrisma();
    const { page, limit, skip } = parsePagination(request.query);

    // Build filter
    const where: Record<string, unknown> = { userId: user.id };
    if (request.query.status) {
      const statuses = request.query.status.split(",").map((s) => s.trim());
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    }
    if (request.query.type) {
      where.type = request.query.type;
    }
    if (request.query.threatModelId) {
      where.threatModelId = request.query.threatModelId;
    }

    const [jobs, total] = await Promise.all([
      prisma.aiJob.findMany({
        where,
        orderBy: { queuedAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          status: true,
          threatModelId: true,
          threatId: true,
          progress: true,
          progressMessage: true,
          error: true,
          result: true,
          queuedAt: true,
          startedAt: true,
          completedAt: true,
        },
      }),
      prisma.aiJob.count({ where }),
    ]);

    return sendList(reply, jobs, { page, limit, total });
  });

  /** GET /api/ai-jobs/:jobId - Get job status and result */
  server.get<{ Params: { jobId: string } }>(
    "/api/ai-jobs/:jobId",
    routeAuthz("authenticated"),
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();

      const job = await prisma.aiJob.findUnique({
        where: { id: request.params.jobId },
      });

      if (!job) {
        return sendNotFound(reply, "AI job", request.params.jobId);
      }

      if (job.userId !== user.id) {
        return sendForbidden(reply, "You do not have access to this job");
      }

      return sendSuccess(reply, {
        id: job.id,
        type: job.type,
        status: job.status,
        threatModelId: job.threatModelId,
        threatId: job.threatId,
        progress: job.progress,
        progressMessage: job.progressMessage,
        result: job.result ? JSON.parse(job.result) : null,
        error: job.error,
        queuedAt: job.queuedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      });
    },
  );

  /** DELETE /api/ai-jobs/:jobId - Cancel a QUEUED or PROCESSING job */
  server.delete<{ Params: { jobId: string } }>(
    "/api/ai-jobs/:jobId",
    routeAuthz("authenticated"),
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();

      const job = await prisma.aiJob.findUnique({
        where: { id: request.params.jobId },
      });

      if (!job) return sendNotFound(reply, "AI job", request.params.jobId);
      if (job.userId !== user.id)
        return sendForbidden(reply, "You do not have access to this job");
      if (job.status !== "QUEUED" && job.status !== "PROCESSING") {
        return sendBadRequest(
          reply,
          `Cannot cancel a job with status ${job.status}.`,
        );
      }

      if (job.status === "PROCESSING") {
        // Signal any live in-process worker to stop after its current component
        const { cancelJob } = await import("../jobs/ai-worker.js");
        cancelJob(job.id);
        // Also immediately write CANCELLED to DB so the UI updates right away
        // (handles the case where the worker died in a prior restart and can't self-update)
        await prisma.aiJob.update({
          where: { id: job.id },
          data: {
            status: "CANCELLED",
            completedAt: new Date(),
            progressMessage: job.checkpoint
              ? "Cancelled — checkpoint saved. Use Resume to continue."
              : "Cancelled by user",
          },
        });
        return sendSuccess(reply, {
          id: job.id,
          status: "CANCELLED",
          hasCheckpoint: !!job.checkpoint,
          message: job.checkpoint
            ? "Cancelled — use Resume to pick up from the last checkpoint"
            : "Cancelled",
        });
      }

      // QUEUED — remove from BullMQ if applicable then mark cancelled
      if (job.bullJobId && process.env.REDIS_URL) {
        try {
          const { Queue } = await import("bullmq");
          const connection = { url: process.env.REDIS_URL };
          // Try both fast and heavy queues (job may be in either)
          const queues = [
            new Queue("ai-fast", { connection }),
            new Queue("ai-heavy", { connection }),
          ];
          for (const q of queues) {
            const bullJob = await q.getJob(job.bullJobId);
            if (bullJob) {
              await bullJob.remove();
              break;
            }
          }
          await Promise.all(queues.map((q) => q.close()));
        } catch {
          // best-effort — intentionally silent
        }
      }

      await prisma.aiJob.update({
        where: { id: job.id },
        data: {
          status: "CANCELLED",
          completedAt: new Date(),
          progressMessage: "Cancelled before starting",
        },
      });

      return sendSuccess(reply, { id: job.id, status: "CANCELLED" });
    },
  );

  /** POST /api/ai-jobs/:jobId/pause - Pause a PROCESSING job.
   *
   * Works like cancel but writes PAUSED status and a pause-specific message.
   * The checkpoint save is driven by the worker's per-component `onCheckpoint`
   * hook (same as cancel), so resume is guaranteed to pick up where it left off.
   */
  server.post<{ Params: { jobId: string } }>(
    "/api/ai-jobs/:jobId/pause",
    routeAuthz("authenticated"),
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();

      const job = await prisma.aiJob.findUnique({
        where: { id: request.params.jobId },
      });

      if (!job) return sendNotFound(reply, "AI job", request.params.jobId);
      if (job.userId !== user.id)
        return sendForbidden(reply, "You do not have access to this job");
      if (!(await canStillEdit(user.id, job)))
        return sendForbidden(reply, EDIT_LOST);
      if (job.status !== "PROCESSING") {
        return sendBadRequest(
          reply,
          `Can only pause a PROCESSING job (current status: ${job.status}).`,
        );
      }

      const { cancelJob } = await import("../jobs/ai-worker.js");
      cancelJob(job.id);
      await prisma.aiJob.update({
        where: { id: job.id },
        data: {
          status: "PAUSED",
          completedAt: new Date(),
          progressMessage: job.checkpoint
            ? "Paused — checkpoint saved. Use Resume to continue."
            : "Paused — no checkpoint yet; Resume will start fresh.",
        },
      });

      return sendSuccess(reply, {
        id: job.id,
        status: "PAUSED",
        hasCheckpoint: !!job.checkpoint,
      });
    },
  );

  /** POST /api/ai-jobs/:jobId/retry - Resume a FAILED, CANCELLED, or PAUSED job in-place.
   *
   * Resets the existing job back to QUEUED using the same ID and re-enqueues it.
   * The worker reads the checkpoint from the job's own record, so no new job is
   * created — the same ID persists until COMPLETED regardless of how many times
   * it is resumed after a crash or network failure.
   */
  server.post<{ Params: { jobId: string } }>(
    "/api/ai-jobs/:jobId/retry",
    routeAuthz("authenticated"),
    async (request, reply) => {
      const job = await loadRerunnableJob(request, reply);
      if (!job) return reply;
      const prisma = await getPrisma();
      if (
        job.status !== "FAILED" &&
        job.status !== "CANCELLED" &&
        job.status !== "PAUSED"
      ) {
        return sendBadRequest(
          reply,
          `Can only retry FAILED, CANCELLED, or PAUSED jobs (current status: ${job.status}).`,
        );
      }

      // Determine whether the saved checkpoint is still valid for this model.
      // The worker also validates this, but we compute it here to set a useful
      // progressMessage and return the mode to the caller.
      let checkpointValid = false;
      if (job.checkpoint && job.threatModelId) {
        const ckpt = JSON.parse(job.checkpoint) as {
          completedComponentIds?: string[];
        };
        const ids = ckpt.completedComponentIds ?? [];
        if (ids.length > 0) {
          const matchCount = await prisma.component.count({
            where: { threatModelId: job.threatModelId, id: { in: ids } },
          });
          checkpointValid = matchCount > 0;
        }
      }

      // Reset the job in-place — same ID, keep checkpoint, clear transient fields.
      if (await replyIfOverSpendCap(reply, prisma, job.organizationId))
        return reply;
      await prisma.aiJob.update({
        where: { id: job.id },
        data: {
          status: "QUEUED",
          error: null,
          startedAt: null,
          completedAt: null,
          progress: 0,
          progressMessage: checkpointValid
            ? "Queued — will resume from checkpoint"
            : "Queued — starting fresh (model changed since last run)",
        },
      });

      // Re-enqueue with the original input and the SAME job ID.
      await requeueJob(job, job.input);

      return sendSuccess(reply, {
        id: job.id,
        status: "QUEUED",
        mode: checkpointValid ? "resume" : "fresh",
      });
    },
  );

  /** POST /api/ai-jobs/:jobId/retry-failed - Re-run ONLY the failed fan-out units.
   *
   * A SUGGEST_THREATS job that fanned out can COMPLETE
   * `partial: true` with `result.failedUnits[]` (children that errored without
   * failing the parent). This re-enqueues the SAME job id with the SAME
   * sessionId, restricting the run to exactly those (componentId, category)
   * pairs via `input.retryUnits`. The pipeline merges the re-run threats into
   * the existing set (the loser-cleanup sweep is scoped to the retried targets
   * in suggest-threats-v2-finalize, so prior survivors are untouched).
   */
  server.post<{ Params: { jobId: string } }>(
    "/api/ai-jobs/:jobId/retry-failed",
    routeAuthz("authenticated"),
    async (request, reply) => {
      const job = await loadRerunnableJob(request, reply);
      if (!job) return reply;
      const prisma = await getPrisma();
      if (job.type !== "SUGGEST_THREATS") {
        return sendBadRequest(
          reply,
          "retry-failed only applies to SUGGEST_THREATS jobs.",
        );
      }
      if (job.status !== "COMPLETED") {
        return sendBadRequest(
          reply,
          `Can only retry failed units of a COMPLETED job (current status: ${job.status}).`,
        );
      }

      // Pull the failed (componentId, category) pairs from the stored result.
      const result = job.result
        ? (JSON.parse(job.result) as {
            failedUnits?: Array<{ componentId: string; category: string }>;
          })
        : null;
      const failedUnits = result?.failedUnits ?? [];
      if (failedUnits.length === 0) {
        return sendBadRequest(reply, "This job has no failed units to retry.");
      }
      const retryUnits = failedUnits.map((u) => ({
        componentId: u.componentId,
        category: u.category,
      }));

      // Re-enqueue the SAME job id with input.retryUnits set. We do NOT touch
      // the stored result/threats — the worker re-runs only the failed pairs
      // on the same sessionId (= job id) and merges. Clearing the checkpoint
      // keeps the fan-out path from short-circuiting on a stale resume.
      const baseInput = JSON.parse(job.input) as Record<string, unknown>;
      const retryInput = JSON.stringify({ ...baseInput, retryUnits });
      if (await replyIfOverSpendCap(reply, prisma, job.organizationId))
        return reply;
      await prisma.aiJob.update({
        where: { id: job.id },
        data: {
          status: "QUEUED",
          error: null,
          startedAt: null,
          completedAt: null,
          progress: 0,
          checkpoint: null,
          input: retryInput,
          progressMessage: `Queued — retrying ${retryUnits.length} failed unit(s)`,
        },
      });

      await requeueJob(job, retryInput);

      return sendSuccess(reply, {
        id: job.id,
        status: "QUEUED",
        retriedUnits: retryUnits.length,
      });
    },
  );
};
