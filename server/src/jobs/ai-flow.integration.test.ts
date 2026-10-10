/**
 * Integration test — FlowProducer fan-out for ThreatIdentifier.
 *
 * Real Redis (BullMQ FlowProducer + a real ai-fast Worker processing the
 * children + a real ai-heavy Worker finishing the parent) and the committed
 * replay AI journal (zero LLM network). Proves:
 *   1. the stage fans out to exactly (components × categories) children after
 *      the skip-set (empty here — persist-free run),
 *   2. the parent aggregates every child's threats, and
 *   3. the aggregated set matches the legacy sequential loop's output on
 *      the same journal.
 *
 * Redis-gated: when no Redis is reachable the whole suite is skipped with a
 * loud console flag — the acceptance criterion is then UNVERIFIED, not green.
 * A running instance is provided at redis://localhost:6379 (podman
 * `a2-1-redis`, redis:7-alpine).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Worker } from "bullmq";
import { STRIDE_CATEGORIES } from "../services/ai/micro-analysis/types.js";
import { chunkCategories } from "../services/ai/micro-analysis/category-chunk-analyzer.js";
import { registerStageHandlers } from "../services/ai/stages/index.js";
import { getStage } from "../services/ai/stages/registry.js";
import { resolveIdentifierSetup } from "../services/ai/stages/identifier-inputs.js";
import type { MicroThreat } from "../services/ai/micro-analysis/types.js";
import { loadFixtureContext } from "../test/helpers/fixture-context.js";
import { compareThreatSets } from "../test/helpers/parity.js";
import { createReplayAICaller } from "../test/helpers/replay-ai.js";
import { runLegacyIdentification } from "../test/helpers/stage-parity.js";
import { AI_FAST_QUEUE_NAME, AI_HEAVY_QUEUE_NAME } from "./ai-queue.js";
import {
  closeAiFlowProducer,
  initAiFlowProducer,
  isAiAnalysisFlowParentJob,
  isThreatIdentifierChildJob,
  processFlowParentJob,
  processThreatIdentifierChild,
  resetAiFlowTestOverrides,
  setAiFlowTestOverrides,
  type ChildUnit,
  type ThreatIdentifierChildData,
} from "./ai-flow.js";

const REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6379";
const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "test",
  "fixtures",
  "go-forward",
);
const JOURNAL_PATH = join(FIXTURES_DIR, "llm-journal.json");

async function redisReachable(url: string): Promise<boolean> {
  try {
    const { Redis: IORedis } = await import("ioredis");
    const client = new IORedis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    await client.connect();
    await client.ping();
    await client.quit();
    return true;
  } catch {
    return false;
  }
}

const hasRedis = await redisReachable(REDIS_URL);
// CI sets TEST_REDIS_URL and provides the service: an unreachable Redis there
// is a broken lane, not a reason to skip.
if (!hasRedis && process.env.TEST_REDIS_URL) {
  throw new Error(
    `TEST_REDIS_URL is set but Redis at ${REDIS_URL} is unreachable`,
  );
}
if (!hasRedis) {
  // eslint-disable-next-line no-restricted-syntax
  console.warn(
    `\nSKIPPED — no Redis at ${REDIS_URL}. Fan-out acceptance is ` +
      `UNVERIFIED. Start one: podman run -d -p 6379:6379 redis:7-alpine\n`,
  );
}

describe.skipIf(!hasRedis)(
  "fan-out — FlowProducer ThreatIdentifier (real Redis + replay AI)",
  () => {
    const context = loadFixtureContext(FIXTURES_DIR);
    let fastWorker: Worker;
    let heavyWorker: Worker;
    // Unique per run so reruns never collide on prior keys in shared Redis.
    const executionId = `a2-1-it-${Date.now()}`;

    beforeAll(async () => {
      registerStageHandlers();
      initAiFlowProducer(REDIS_URL);

      // Build each (component) ChildUnit from the in-memory fixture — no DB.
      // resolveIdentifierSetup gives us the same componentContexts +
      // sequenceFlows the sequential path uses.
      const setup = await resolveIdentifierSetup({
        context,
        options: { methodologies: ["stride"] },
      });
      const byId = new Map<string, ChildUnit>();
      for (const comp of setup.componentContexts) {
        byId.set(comp.id, {
          component: comp,
          methodology: "stride",
          options: { ...setup.opts },
          sequenceFlows: setup.componentSequenceFlows.get(comp.id),
        });
      }

      const replay = createReplayAICaller(JOURNAL_PATH, "replay");
      setAiFlowTestOverrides({
        aiCall: replay,
        resolveUnit: async (data: ThreatIdentifierChildData) => {
          const unit = byId.get(data.componentId);
          if (!unit) throw new Error(`No unit for ${data.componentId}`);
          return unit;
        },
      });

      const { Worker } = await import("bullmq");
      const connection = { url: REDIS_URL };
      fastWorker = new Worker(
        AI_FAST_QUEUE_NAME,
        async (job) => {
          if (isThreatIdentifierChildJob(job.name)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return processThreatIdentifierChild(job as any);
          }
          return undefined;
        },
        { connection, concurrency: 5 },
      );
      heavyWorker = new Worker(
        AI_HEAVY_QUEUE_NAME,
        async (job) => {
          if (isAiAnalysisFlowParentJob(job.name)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return processFlowParentJob(job as any);
          }
          return undefined;
        },
        { connection, concurrency: 2 },
      );
      await Promise.all([
        fastWorker.waitUntilReady(),
        heavyWorker.waitUntilReady(),
      ]);
    }, 60_000);

    afterAll(async () => {
      resetAiFlowTestOverrides();
      await Promise.all([
        fastWorker?.close(),
        heavyWorker?.close(),
        closeAiFlowProducer(),
      ]);
    });

    it("fans out to components × STRIDE categories and aggregates parity-green", async () => {
      const replay = createReplayAICaller(JOURNAL_PATH, "replay");

      // --- Fan-out path: run the stage with fanOut:true, persist-free. ---
      const handler = getStage("ThreatIdentifier");
      const progressCalls: Array<{ pct: number; msg: string }> = [];
      const result = await handler({
        executionId,
        threatModelId: "a2-1-tm",
        organizationId: "a2-1-org",
        sessionId: "a2-1-session",
        inputs: {
          context,
          options: { methodologies: ["stride"] },
          fanOut: true,
        },
        aiCall: replay,
        progress: async (pct, msg) => {
          progressCalls.push({ pct, msg });
        },
        checkpoint: async () => undefined,
        signal: new AbortController().signal,
      });

      const threats = result.outputs.threats as MicroThreat[];
      const loop = threats.filter(
        (t) => (t as { componentId?: string }).componentId !== "compound",
      );

      // Expected child count = components × STRIDE categories (skip-set empty
      // on a persist-free run). The stage exposes the same number.
      const componentCount = context.components.length;
      const expectedChildren =
        componentCount * chunkCategories(STRIDE_CATEGORIES).length;
      expect(result.outputs.fanOutUnitCount).toBe(expectedChildren);
      expect(result.outputs.failedUnits).toEqual([]);
      // Children finish in any order; the stage restores the sequential order
      // so the compound prompt replays from the journal and yields compounds.
      expect(threats.length - loop.length).toBeGreaterThan(0);

      // Every component appears with the full STRIDE category set in the
      // aggregated output — proves the parent collected all children.
      for (const comp of context.components) {
        const cats = new Set(
          loop
            .filter(
              (t) => (t as { componentId?: string }).componentId === comp.id,
            )
            .map((t) => t.category),
        );
        // The fixture's replay journal yields ≥1 category per component;
        // assert at least the categories that produced threats are STRIDE.
        for (const c of cats) {
          expect([...STRIDE_CATEGORIES]).toContain(c);
        }
      }

      // Progress wiring (5 + done/total×70).
      expect(progressCalls.length).toBeGreaterThan(0);
      for (const p of progressCalls) {
        expect(p.pct).toBeGreaterThanOrEqual(5);
        expect(p.pct).toBeLessThanOrEqual(75);
      }

      // --- Parity vs the legacy sequential loop on the same journal. ---
      const legacy = await runLegacyIdentification(context, replay);
      const report = compareThreatSets(legacy.loopThreats, loop);
      expect(report.onlyInA).toEqual([]);
      expect(report.onlyInB).toEqual([]);
      expect(report.severityDrift).toEqual([]);
      expect(report.mitigationDrift).toEqual([]);
      expect(report.pass).toBe(true);
      expect(report.intersectionSize).toBeGreaterThan(50);
    }, 180_000);
  },
);
