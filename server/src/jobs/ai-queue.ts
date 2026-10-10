import logger from "../utils/logger.js";
/**
 * AI Job Queue
 *
 * Background job processing for AI operations (threat suggestions,
 * document extraction, attack trees, severity calculations, etc.).
 * Uses BullMQ with Redis for reliable async processing.
 *
 * Two queues are created to avoid heavy LLM jobs starving fast ones:
 *   ai-fast  — concurrency 5, handles lightweight AI calls
 *   ai-heavy — concurrency 2, handles long-running extraction / threat generation
 *
 * Setup:
 *   1. Set REDIS_URL in environment
 *   2. Import and initialize in server startup
 *
 * Usage in route handlers:
 *   import { enqueueAiJob } from '../jobs/ai-queue.js';
 *   const job = await enqueueAiJob({ type: 'SUGGEST_THREATS', ... });
 */

/** @public Referenced as import("...").AiJobType, which knip cannot see. */
export type AiJobType =
  | "SUGGEST_THREATS"
  | "SUGGEST_MITIGATIONS"
  | "EXTRACT_DOCUMENT"
  | "EXTRACT_DIAGRAM"
  | "ATTACK_TREE"
  | "CALCULATE_SEVERITY"
  | "SEQUENCE_DIAGRAM"
  | "REFINEMENT_QUESTIONS"
  | "VERIFY_CITATIONS"
  | "REFRESH_MITIGATIONS"
  | "ATTACK_CHAIN_ANALYSIS"
  | "ARCHITECTURAL_MITIGATIONS";

export interface AiJobData {
  type: AiJobType;
  userId: string;
  organizationId: string;
  threatModelId?: string;
  threatId?: string;
  input: string; // JSON-encoded job-specific input
  dbJobId: string; // Prisma AiJob.id for status tracking
}

// Queue name constants
export const AI_FAST_QUEUE_NAME = "ai-fast";
export const AI_HEAVY_QUEUE_NAME = "ai-heavy";

/**
 * Lock durations, stated as constants so they are assertable.
 *
 * BullMQ's default lockDuration is 30 SECONDS. `ai-fast` had no value, so it
 * ran on that default — and every job on that queue is an LLM call: chat,
 * refinement and attack-tree (anything not in HEAVY_TYPES), plus the
 * ThreatIdentifier fan-out children, which are enqueued to this queue by name
 * in ai-flow.ts and each run `analyzeComponent` against a provider.
 *
 * The lock is renewed on a timer at lockDuration/2, so 30s left only ~15s of
 * margin: block the event loop past that — a large JSON parse of a provider
 * reply will do it — and the lock expires, BullMQ redelivers the job as
 * stalled (independently of `attempts: 1`), and the provider is called twice.
 * Children never persist, so the cost is duplicate SPEND and wasted wall-clock,
 * not duplicate rows.
 *
 * 10 minutes is derived from the worst case of one child: a provider call
 * capped at AI_PROVIDER_TIMEOUT_MS (120s default) times lmstudio's three
 * transient retries plus its backoff — about 6.3 minutes.
 *
 * The cost of a longer lock is the honest tradeoff: when a worker genuinely
 * dies, its in-flight job waits this long before another worker can claim it.
 * That is strictly better than today, where a healthy worker loses jobs it is
 * still working on.
 */
export const AI_FAST_LOCK_DURATION_MS = 10 * 60 * 1000;

/** Long-running extraction / threat generation — jobs here run 30+ minutes. */
export const AI_HEAVY_LOCK_DURATION_MS = 35 * 60 * 1000;

/**
 * Job types that are routed to the heavy queue (long-running LLM calls).
 * All other types go to the fast queue.
 */
const HEAVY_TYPES = new Set<AiJobType>([
  "SUGGEST_THREATS",
  "EXTRACT_DOCUMENT",
  "EXTRACT_DIAGRAM",
  "REFRESH_MITIGATIONS",
  "ATTACK_CHAIN_ANALYSIS",
  "ARCHITECTURAL_MITIGATIONS",
]);

/**
 * Initialize the AI job queues and workers.
 * Call once during server startup when Redis is available.
 */
export async function initAiQueue(redisUrl: string): Promise<void> {
  // Dynamic import — only loads BullMQ when actually needed
  const { Queue, Worker } = await import("bullmq");
  const { processAiJob } = await import("./ai-worker.js");
  // FlowProducer for ThreatIdentifier fan-out + name-based routing of
  // its parent/child jobs (which carry non-AiJobData payloads).
  const {
    initAiFlowProducer,
    isThreatIdentifierChildJob,
    isAiAnalysisFlowParentJob,
    processThreatIdentifierChild,
    processFlowParentJob,
  } = await import("./ai-flow.js");
  initAiFlowProducer(redisUrl);
  // Stage-boundary Redis cache reuses the same Redis URL. Pure
  // optimization — if this is never initialized the cache no-ops and stages
  // execute normally.
  const { initStageCache } = await import(
    "../services/ai/stages/stage-cache.js"
  );
  initStageCache(redisUrl);

  const connection = { url: redisUrl };

  // --- Fast queue (lightweight AI calls + fan-out children) ---
  _fastQueue = new Queue<AiJobData>(AI_FAST_QUEUE_NAME, { connection });

  const fastWorker = new Worker<AiJobData, unknown>(
    AI_FAST_QUEUE_NAME,
    async (job) => {
      if (isThreatIdentifierChildJob(job.name)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return processThreatIdentifierChild(job as any);
      }
      return processAiJob(job.data);
    },
    {
      connection,
      concurrency: 5,
      // Without this the queue ran on BullMQ's 30s default while every job
      // on it is an LLM call. See AI_FAST_LOCK_DURATION_MS.
      lockDuration: AI_FAST_LOCK_DURATION_MS,
      limiter: {
        max: 30,
        duration: 60_000,
      },
    },
  );

  fastWorker.on("completed", (job) => {
    logger.info(
      `AI fast job ${job.id} completed (type: ${job.data?.type ?? job.name})`,
    );
  });

  fastWorker.on("failed", (job, err) => {
    logger.error({ err: err.message }, `AI fast job ${job?.id} failed:`);
  });

  // --- Heavy queue (long-running extraction / threat generation) ---
  _heavyQueue = new Queue<AiJobData>(AI_HEAVY_QUEUE_NAME, { connection });

  const heavyWorker = new Worker<AiJobData, unknown>(
    AI_HEAVY_QUEUE_NAME,
    async (job) => {
      if (isAiAnalysisFlowParentJob(job.name)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return processFlowParentJob(job as any);
      }
      return processAiJob(job.data);
    },
    {
      connection,
      concurrency: 2,
      // AI jobs like SUGGEST_THREATS and EXTRACT_DOCUMENT run for 30+ minutes.
      // Without this, BullMQ's default 30s lock expires mid-job and redelivers
      // the job on any worker restart, producing duplicate threat rows.
      lockDuration: AI_HEAVY_LOCK_DURATION_MS,
      limiter: {
        max: 10,
        duration: 60_000,
      },
    },
  );

  heavyWorker.on("completed", (job) => {
    logger.info(
      `AI heavy job ${job.id} completed (type: ${job.data?.type ?? job.name})`,
    );
  });

  heavyWorker.on("failed", (job, err) => {
    logger.error({ err: err.message }, `AI heavy job ${job?.id} failed:`);
  });
}

let _fastQueue: import("bullmq").Queue<AiJobData> | null = null;
let _heavyQueue: import("bullmq").Queue<AiJobData> | null = null;

/**
 * Enqueue an AI job for background processing.
 * Heavy job types (SUGGEST_THREATS, EXTRACT_DOCUMENT, EXTRACT_DIAGRAM,
 * REFRESH_MITIGATIONS) go to the heavy queue; all others go to fast.
 * Returns the BullMQ job ID for correlation.
 */
export async function enqueueAiJob(data: AiJobData): Promise<{ id: string }> {
  const targetQueue = HEAVY_TYPES.has(data.type) ? _heavyQueue : _fastQueue;

  if (!targetQueue) {
    throw new Error(
      "AI queue not initialized. Set REDIS_URL and call initAiQueue() at startup.",
    );
  }

  // Enforce the org's monthly AI spend cap before doing any work (AI-SPEND).
  const { getPrisma: getPrismaForSpend } = await import("../db.js");
  const { assertWithinSpendCap } = await import(
    "../services/ai/spend-guard.js"
  );
  await assertWithinSpendCap(await getPrismaForSpend(), data.organizationId);

  const job = await targetQueue.add("ai", data, {
    // SUGGEST_THREATS can run for 30+ minutes and persist results streamingly.
    // An automatic retry re-runs the entire pipeline and produces paraphrase
    // duplicates of every previously-persisted threat. Any retry must be
    // driven explicitly by the user via the retry endpoint (which resumes
    // from checkpoint), never silently by BullMQ.
    attempts: 1,
    removeOnComplete: { age: 86400 }, // Keep completed jobs for 24h
    removeOnFail: { age: 604800 }, // Keep failed jobs for 7 days
  });

  // Correlate BullMQ job ID with the DB record
  const { getPrisma } = await import("../db.js");
  const prisma = await getPrisma();
  await prisma.aiJob.update({
    where: { id: data.dbJobId },
    data: { bullJobId: job.id },
  });

  return { id: job.id ?? "unknown" };
}

/**
 * Run an AI job in-process without Redis/BullMQ.
 * Used when REDIS_URL is not set — creates the DB record immediately,
 * fires the worker in the background, returns the jobId for polling.
 */
export function runJobInBackground(data: AiJobData): void {
  setImmediate(async () => {
    const { processAiJob } = await import("./ai-worker.js");
    try {
      await processAiJob(data);
    } catch (err) {
      // Worker already marks the job FAILED in DB on error; this is belt-and-suspenders
      const { getPrisma } = await import("../db.js");
      const prisma = await getPrisma();
      await prisma.aiJob
        .update({
          where: { id: data.dbJobId },
          data: {
            status: "FAILED",
            error: err instanceof Error ? err.message : String(err),
            completedAt: new Date(),
          },
        })
        .catch(() => {});
    }
  });
}
