/**
 * Integration test — partial failure + retry failed units.
 *
 * Real Redis (FlowProducer + a real ai-fast Worker running the children + a
 * real ai-heavy Worker finishing the parent) and the committed replay AI
 * journal (zero LLM network). Proves:
 *   1. fault-injecting 2 children → the job COMPLETES (parent never fails),
 *      surfacing EXACTLY those 2 in `outputs.failedUnits`; `partial` is set on
 *      the finalized result,
 *   2. `retryUnits` re-runs EXACTLY those 2 pairs (resolveUnit call count
 *      proves it — the full grid is never re-derived), and
 *   3. partial-run threats + retry threats == the no-fault run.
 *
 * Fault injection: the child's unit resolver throws for the two targeted
 * (componentId, category) pairs. A thrown resolver propagates out of
 * processThreatIdentifierChild → the child job FAILS →
 * `ignoreDependencyOnFailure: true` moves it to the parent's ignored failures
 * (recorded in `failedUnits`, parent unaffected). This is the same failure
 * surface a real mid-analysis child error produces.
 *
 * Redis-gated like ai-flow.integration.test.ts: no Redis → the whole suite is skipped with a loud
 * flag (acceptance UNVERIFIED, not green). A running instance is provided at
 * redis://localhost:6379 (podman `a22redis`, redis:7-alpine).
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
  unitCategories,
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
    `\nSKIPPED — no Redis at ${REDIS_URL}. Partial-failure/retry ` +
      `acceptance is UNVERIFIED. Start one: podman run -d -p 6379:6379 ` +
      `redis:7-alpine\n`,
  );
}

/** Strip the "compound" sub-step threats for set comparison. */
function loopThreats(threats: MicroThreat[]): MicroThreat[] {
  return threats.filter(
    (t) => (t as { componentId?: string }).componentId !== "compound",
  );
}

describe.skipIf(!hasRedis)(
  "partial failure + retry (real Redis + replay AI)",
  () => {
    const context = loadFixtureContext(FIXTURES_DIR);
    let fastWorker: Worker;
    let heavyWorker: Worker;
    // Components whose two categories we fault-inject (first component).
    let targetComponentId: string;
    const failCats = ["SPOOFING", "TAMPERING"] as const;
    // Counts every resolveUnit call so the retry can prove it ran ONLY 2 units.
    let resolveCalls: ThreatIdentifierChildData[] = [];
    // Set true to fault-inject the two target pairs; false for the retry run.
    let injectFaults = false;
    let byId: Map<string, ChildUnit>;

    beforeAll(async () => {
      registerStageHandlers();
      initAiFlowProducer(REDIS_URL);

      const setup = await resolveIdentifierSetup({
        context,
        options: { methodologies: ["stride"] },
      });
      targetComponentId = setup.componentContexts[0].id;
      byId = new Map<string, ChildUnit>();
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
          resolveCalls.push(data);
          // Fault injection: a child whose pair is targeted throws here, so
          // the child job fails and is moved to the parent's ignored failures.
          if (
            injectFaults &&
            data.componentId === targetComponentId &&
            unitCategories(data).some((c) =>
              (failCats as readonly string[]).includes(c),
            )
          ) {
            throw new Error(
              `injected fault: ${unitCategories(data).join("+")}`,
            );
          }
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

    async function runStage(
      executionId: string,
      extraOptions: Record<string, unknown> = {},
    ): Promise<{ outputs: Record<string, unknown> }> {
      const replay = createReplayAICaller(JOURNAL_PATH, "replay");
      const handler = getStage("ThreatIdentifier");
      const result = await handler({
        executionId,
        threatModelId: "a2-2-tm",
        organizationId: "a2-2-org",
        sessionId: "a2-2-session",
        inputs: {
          context,
          options: { methodologies: ["stride"], ...extraOptions },
          fanOut: true,
        },
        aiCall: replay,
        progress: async () => undefined,
        checkpoint: async () => undefined,
        signal: new AbortController().signal,
      });
      return result as { outputs: Record<string, unknown> };
    }

    it("kills the [S,T,R] chunk child → partial completion → retry re-runs exactly that chunk → set parity with no-fault run", async () => {
      // one child per fixed category chunk ([S,T,R] [I,D,E]).
      const strideChunks = chunkCategories(STRIDE_CATEGORIES);
      const expectedGrid = context.components.length * strideChunks.length;
      // S and T share the first chunk, so the whole [S,T,R] child fails and
      // is reported as one failed unit per category.
      const failedChunk = strideChunks[0];

      // --- 0. No-fault baseline (the merge target). ---
      injectFaults = false;
      resolveCalls = [];
      const baseline = await runStage(`a2-2-base-${Date.now()}`);
      const baselineThreats = loopThreats(
        baseline.outputs.threats as MicroThreat[],
      );
      expect(baseline.outputs.failedUnits).toEqual([]);
      expect(baseline.outputs.fanOutUnitCount).toBe(expectedGrid);

      // --- 1. Faulted run: 2 children throw → parent COMPLETES partial. ---
      injectFaults = true;
      resolveCalls = [];
      const faulted = await runStage(`a2-2-fault-${Date.now()}`);
      const faultedUnits = faulted.outputs.failedUnits as Array<{
        componentId: string;
        category: string;
        error: string;
      }>;

      // Exactly the targeted chunk failed; parent did not throw.
      expect(faulted.outputs.fanOutUnitCount).toBe(expectedGrid);
      expect(faultedUnits).toHaveLength(failedChunk.length);
      const failedKeys = new Set(
        faultedUnits.map((u) => `${u.componentId}::${u.category}`),
      );
      expect(failedKeys).toEqual(
        new Set(failedChunk.map((c) => `${targetComponentId}::${c}`)),
      );
      for (const u of faultedUnits) {
        expect(u.error).toContain("injected fault");
      }

      // The partial run is missing the 2 failed units' threats.
      const faultedThreats = loopThreats(
        faulted.outputs.threats as MicroThreat[],
      );
      expect(faultedThreats.length).toBeLessThan(baselineThreats.length);

      // --- 2. Retry ONLY the failed pairs (no faults this time). ---
      injectFaults = false;
      resolveCalls = [];
      const retryUnits = faultedUnits.map((u) => ({
        componentId: u.componentId,
        category: u.category,
      }));
      const retried = await runStage(`a2-2-retry-${Date.now()}`, {
        retryUnits,
      });

      // resolveUnit ran for EXACTLY the 2 retried pairs — the full grid was
      // never re-derived.
      // The failed categories regroup into their fixed chunk: one child.
      const retriedPairKeys = new Set(
        resolveCalls.flatMap((d) =>
          unitCategories(d).map((c) => `${d.componentId}::${c}`),
        ),
      );
      expect(resolveCalls).toHaveLength(1);
      expect(retriedPairKeys).toEqual(failedKeys);
      expect(retried.outputs.fanOutUnitCount).toBe(1);
      expect(retried.outputs.failedUnits).toEqual([]);

      // --- 3. partial-run threats + retry threats == no-fault run. ---
      const retriedThreats = loopThreats(
        retried.outputs.threats as MicroThreat[],
      );
      const merged = [...faultedThreats, ...retriedThreats];
      const report = compareThreatSets(baselineThreats, merged);
      expect(report.onlyInA).toEqual([]);
      expect(report.onlyInB).toEqual([]);
      expect(report.severityDrift).toEqual([]);
      expect(report.pass).toBe(true);
      expect(report.intersectionSize).toBeGreaterThan(50);
    }, 180_000);
  },
);
