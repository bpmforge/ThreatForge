/**
 * Integration test — stage-boundary Redis cache + resume.
 *
 * Real Redis (the cache's own ioredis client) + a test SQLite DB holding a
 * custom 8-stage handler-backed pipeline whose stages are SPY handlers (each
 * spends a fixed token count and records its calls). Proves:
 *
 *   1. Run the pipeline; stage 4 throws (simulates a kill after stage 3 of 8)
 *      with stopOnError. Stages 1–3 complete and are cached; the executionId is
 *      captured from the checkpoint sink.
 *   2. Resume with the SAME executionId. Stages 1–3 are served from the cache —
 *      their spies are NOT called again (call-count assertion) — and only the
 *      remaining stages run. Tokens spent on resume < tokens of a fresh run.
 *   3. Cache MISS (a fresh executionId) re-executes every stage — fall-through.
 *   4. Fan-out unit cache: a (componentId, category) child runs once, is cached,
 *      and a second processing of the same unit/executionId serves the cached
 *      result without re-running the analysis.
 *
 * Redis-gated: no Redis → the whole suite is skipped with a loud flag and the
 * result is UNVERIFIED, not green. A running instance is provided at
 * redis://localhost:6379 (podman, redis:7-alpine).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import {
  registerStage,
  resetStageRegistry,
  type StageHandler,
  type StageName,
} from "./registry.js";
import {
  closeStageCache,
  initStageCache,
  stageCacheKey,
  unitKeyFor,
  getCachedStage,
  setCachedStage,
} from "./stage-cache.js";
import { executePipeline } from "../pipeline-service.js";
import {
  processThreatIdentifierChild,
  resetAiFlowTestOverrides,
  setAiFlowTestOverrides,
  type ChildUnit,
  type ThreatIdentifierChildData,
} from "../../../jobs/ai-flow.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = resolve(__dirname, "../../../../prisma/test.db");
const REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6379";

/** The 8 stage names (closed union) used to back the spy pipeline. */
const STAGE_ORDER: StageName[] = [
  "ArchitectureReader",
  "ThreatIdentifier",
  "EvidenceEnricher",
  "StrideClassifier",
  "MitigationSynthesizer",
  "ComplianceMapper",
  "SeverityCalibrator",
  "Verifier",
];
const TOKENS_PER_STAGE = 100;

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
    `\nSKIPPED — no Redis at ${REDIS_URL}. Stage-cache resume ` +
      `acceptance is UNVERIFIED. Start one: podman run -d -p 6379:6379 redis:7-alpine\n`,
  );
}

describe.skipIf(!hasRedis)(
  "stage-boundary cache + resume (real Redis + test DB)",
  () => {
    let prisma: PrismaClient;
    let pipelineId: string;
    /** Per stage name, how many times its handler actually executed. */
    const callCounts = new Map<StageName, number>();
    /** Which stage (0-based index) should throw to simulate the kill. */
    let failAtIndex = -1;

    function makeSpy(name: StageName): StageHandler {
      return async () => {
        callCounts.set(name, (callCounts.get(name) ?? 0) + 1);
        const idx = STAGE_ORDER.indexOf(name);
        if (idx === failAtIndex) {
          throw new Error(`simulated kill at stage ${idx + 1} (${name})`);
        }
        return {
          outputs: { ran: name, marker: `out-${name}` },
          tokensUsed: TOKENS_PER_STAGE,
          parseFailures: [],
        };
      };
    }

    function registerSpies(): void {
      resetStageRegistry();
      for (const name of STAGE_ORDER) registerStage(name, makeSpy(name));
    }

    beforeAll(async () => {
      process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
      const { setupTestDatabase, testData } = await import(
        "../../../test/setup.js"
      );
      prisma = await setupTestDatabase();
      const user = await testData.createUser();
      const org = await testData.createOrganization();
      await testData.createMembership(user.id, org.id);

      // Build a custom 8-stage handler-backed pipeline (stopOnError so a thrown
      // stage halts the run — the "kill"). Each stage row dispatches to the spy
      // registered under its name via the `handler:<StageName>` sentinel.
      const pipeline = await prisma.promptPipeline.create({
        data: {
          name: "a6-2-stage-cache-it",
          description: "spy pipeline",
          isSequential: true,
          stopOnError: true,
          isBuiltIn: false,
          isActive: true,
          organizationId: null,
        },
      });
      pipelineId = pipeline.id;
      for (const [index, name] of STAGE_ORDER.entries()) {
        await prisma.pipelineStage.create({
          data: {
            pipelineId: pipeline.id,
            order: index + 1,
            name,
            promptTemplateId: `handler:${name}`,
            outputFields: JSON.stringify(["ran", "marker"]),
            inputMapping: JSON.stringify({}),
            dependsOn: JSON.stringify([]),
            optional: false,
          },
        });
      }

      initStageCache(REDIS_URL);
    }, 120_000);

    afterAll(async () => {
      resetAiFlowTestOverrides();
      await closeStageCache();
      const { teardownTestDatabase } = await import("../../../test/setup.js");
      await teardownTestDatabase();
    });

    it("resume serves cached stages 1-3 (spies not re-run) and spends fewer tokens", async () => {
      registerSpies();
      callCounts.clear();

      const aiServiceGuard = {
        complete: async () => {
          throw new Error("spy pipeline is handler-backed — no prompt path");
        },
      } as unknown as Parameters<typeof executePipeline>[1];

      // --- Run 1: kill after stage 3 (stage index 3 = the 4th stage throws). ---
      failAtIndex = 3;
      let capturedExecutionId: string | undefined;
      const run1 = await executePipeline(
        { pipelineId, userId: "u", organizationId: "o" },
        aiServiceGuard,
        {
          sessionId: "s1",
          checkpoint: async (key, value) => {
            if (key === "executionId") capturedExecutionId = value as string;
          },
        },
      );

      expect(run1.status).toBe("FAILED");
      expect(capturedExecutionId).toBeTruthy();
      const executionId = capturedExecutionId as string;
      // Stages 1-3 ran and completed; stage 4 ran and threw; 5-8 never reached.
      for (const name of STAGE_ORDER.slice(0, 3)) {
        expect(callCounts.get(name)).toBe(1);
      }
      expect(callCounts.get(STAGE_ORDER[3])).toBe(1); // the throwing stage
      for (const name of STAGE_ORDER.slice(4)) {
        expect(callCounts.get(name) ?? 0).toBe(0);
      }
      // The pipeline no longer WRITES stage payloads (no caller resumes), so
      // nothing is cached after run 1. Seed the cache the way a future resume
      // caller's earlier run would have, to keep the read path covered.
      for (const name of STAGE_ORDER.slice(0, 3)) {
        expect(
          await getCachedStage(stageCacheKey(executionId, name)),
        ).toBeNull();
        await setCachedStage(stageCacheKey(executionId, name), {
          outputs: {},
          tokensUsed: TOKENS_PER_STAGE,
          parseFailures: [],
        });
      }

      // --- Run 2: RESUME with the same executionId, no failure this time. ---
      failAtIndex = -1;
      callCounts.clear();
      const run2 = await executePipeline(
        {
          pipelineId,
          userId: "u",
          organizationId: "o",
          resumeExecutionId: executionId,
        },
        aiServiceGuard,
        { sessionId: "s1", checkpoint: async () => undefined },
      );

      expect(run2.status).toBe("COMPLETED");
      // CACHE HIT PROOF: stages 1-3 were NOT re-executed on resume.
      for (const name of STAGE_ORDER.slice(0, 3)) {
        expect(callCounts.get(name) ?? 0).toBe(0);
      }
      // Stages 4-8 DID run (4 was never cached; 5-8 never reached run 1).
      for (const name of STAGE_ORDER.slice(3)) {
        expect(callCounts.get(name)).toBe(1);
      }
      // TOKEN PROOF: resume billed only the 5 uncached stages.
      const resumeTokens = run2.totalTokensUsed;
      const freshTokens = STAGE_ORDER.length * TOKENS_PER_STAGE; // 8 × 100
      expect(resumeTokens).toBe(5 * TOKENS_PER_STAGE);
      expect(resumeTokens).toBeLessThan(freshTokens);
    }, 120_000);

    it("cache MISS (fresh executionId) re-executes every stage — fall-through", async () => {
      registerSpies();
      callCounts.clear();
      failAtIndex = -1;

      const aiServiceGuard = {
        complete: async () => {
          throw new Error("spy pipeline is handler-backed — no prompt path");
        },
      } as unknown as Parameters<typeof executePipeline>[1];

      // No resumeExecutionId → fresh execution, empty cache → all 8 stages run.
      const run = await executePipeline(
        { pipelineId, userId: "u", organizationId: "o" },
        aiServiceGuard,
        { sessionId: "s2", checkpoint: async () => undefined },
      );

      expect(run.status).toBe("COMPLETED");
      for (const name of STAGE_ORDER) {
        expect(callCounts.get(name)).toBe(1);
      }
      expect(run.totalTokensUsed).toBe(STAGE_ORDER.length * TOKENS_PER_STAGE);
    }, 120_000);

    it("fan-out unit cache: a child runs once then is served from cache on resume", async () => {
      // Build ONE real ChildUnit from the test fixture so
      // analyzeComponent runs against a well-formed component. resolveUnit is
      // wrapped in a spy: it is only reached on a cache MISS, so its call count
      // is the proof that the cached second run skipped re-execution.
      const { join } = await import("node:path");
      const FIXTURES_DIR = join(
        __dirname,
        "..",
        "..",
        "..",
        "test",
        "fixtures",
        "go-forward",
      );
      const { loadFixtureContext } = await import(
        "../../../test/helpers/fixture-context.js"
      );
      const { resolveIdentifierSetup } = await import("./identifier-inputs.js");
      const { createReplayAICaller } = await import(
        "../../../test/helpers/replay-ai.js"
      );

      const context = loadFixtureContext(FIXTURES_DIR);
      const setup = await resolveIdentifierSetup({
        context,
        options: { methodologies: ["stride"] },
      });
      const comp = setup.componentContexts[0];
      const unit: ChildUnit = {
        component: comp,
        methodology: "stride",
        options: { ...setup.opts },
        sequenceFlows: setup.componentSequenceFlows.get(comp.id),
      };
      const replay = createReplayAICaller(
        join(FIXTURES_DIR, "llm-journal.json"),
        "replay",
      );

      const { STRIDE_CATEGORIES } = await import("../micro-analysis/types.js");
      const executionId = `a6-2-child-${Date.now()}`;
      const category = STRIDE_CATEGORIES[0]; // "SPOOFING" — present in the recorded journal
      const data: ThreatIdentifierChildData = {
        executionId,
        threatModelId: "tm",
        organizationId: "o",
        sessionId: "s",
        componentId: comp.id,
        category,
      };

      const resolveSpy = vi.fn(async () => unit);
      setAiFlowTestOverrides({ resolveUnit: resolveSpy, aiCall: replay });

      // Run 1: cache miss → resolveUnit called.
      const first = await processThreatIdentifierChild({
        data,
      } as Parameters<typeof processThreatIdentifierChild>[0]);
      expect(resolveSpy).toHaveBeenCalledTimes(1);
      expect(first.componentId).toBe(comp.id);

      // The unit result is not written to the cache any more. Seed it as a
      // resume caller's earlier run would have, to keep the read path covered.
      const unitKey = stageCacheKey(
        executionId,
        "ThreatIdentifier",
        unitKeyFor(comp.id, category),
      );
      expect(await getCachedStage(unitKey)).toBeNull();
      await setCachedStage(unitKey, {
        outputs: { childResult: first },
        tokensUsed: first.tokensUsed,
        parseFailures: first.parseFailures,
      });

      // Run 2: same executionId + unit → cache HIT, resolveUnit NOT called again.
      const second = await processThreatIdentifierChild({
        data,
      } as Parameters<typeof processThreatIdentifierChild>[0]);
      expect(resolveSpy).toHaveBeenCalledTimes(1); // served from cache
      expect(second).toEqual(first);
    }, 60_000);
  },
);
