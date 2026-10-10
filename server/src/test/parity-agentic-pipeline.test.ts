/**
 * Agentic-mode parity gate: legacy multi-framework vs
 * agentic-analysis-v2 pipeline.
 *
 * Both paths run the SAME parallel framework runners (STRIDE / PASTA / Kill
 * Chain / MITRE ATT&CK) + verify loop on the go-forward fixture with the committed
 * replay journal (zero network — any prompt drift throws ReplayMiss):
 * - legacy: runAgenticAnalysis(client, context) — exactly what the flag-off
 *   worker drives (the AIProviderClient.complete delegates to the replay
 *   AICallFn so both paths hit the same journal hashes).
 * - v2: runAgenticAnalysisV2 — the function the flag-on worker calls; drives
 *   the seeded agentic-analysis-v2 PromptTemplate-backed runner stages and
 *   writes PipelineExecution + PipelineStageExecution rows.
 *
 * Compared with the parity comparator on the ADR-006 key (set semantics,
 * order-independent). The agentic path stores its report in AiJob.result only
 * (no Threat rows), so this compares the in-memory AgenticAnalysisResult.threats.
 *
 * Acceptance: all four methodologies' children are visible in the flow: the
 * four runner stages (StrideRunner / PastaRunner / KillChainRunner /
 * MitreAttackRunner) are asserted present as COMPLETED PipelineStageExecution
 * rows. (The agentic runners are whole-architecture passes, so the methodology
 * dimension is one runner STAGE per methodology — see agentic-analysis-v2.ts
 * header for the methodology→fan-out mapping and why a per-(component,category)
 * FlowProducer fan-out would break parity with the legacy path.)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import type {
  AICompletionOptions,
  AICompletionResponse,
  AIProviderClient,
} from "../types/ai.js";
import type { AICallFn } from "../services/ai/micro-analysis/types.js";
import type {
  AgenticAnalysisResult,
  AgenticThreat,
} from "../services/ai/agentic-analysis.js";
import { loadFixtureContext } from "./helpers/fixture-context.js";
import { compareThreatSets, type ThreatLike } from "./helpers/parity.js";
import { createReplayAICaller, ReplayMiss } from "./helpers/replay-ai.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures", "go-forward");
const JOURNAL_PATH = join(FIXTURES_DIR, "llm-journal.json");
const TEST_DB_PATH = resolve(__dirname, "../../prisma/test.db");

/** The four methodology runner stage names the gate asserts. */
const METHODOLOGY_STAGES = [
  "StrideRunner",
  "PastaRunner",
  "KillChainRunner",
  "MitreAttackRunner",
];

/** Map an AgenticThreat to the comparator's ThreatLike shape (ADR-006 key). */
function toThreatLike(t: AgenticThreat): ThreatLike {
  return {
    name: t.title,
    category: t.category,
    severity: (["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(
      t.severity,
    )
      ? t.severity
      : "MEDIUM") as ThreatLike["severity"],
    componentId: t.targetComponentId,
    mitigationCount: t.mitigation ? 1 : 0,
  };
}

/** AIProviderClient whose complete() delegates to a replay AICallFn. */
function replayClient(caller: AICallFn): AIProviderClient {
  return {
    provider: "lmstudio",
    isAvailable: async () => true,
    complete: async (
      opts: AICompletionOptions,
    ): Promise<AICompletionResponse> => {
      const sys = opts.messages.find((m) => m.role === "system")?.content ?? "";
      const usr = opts.messages.find((m) => m.role === "user")?.content ?? "";
      const content = await caller(String(sys), String(usr));
      return { content, provider: "lmstudio", model: "replay" };
    },
  };
}

/** Has the agentic journal been recorded? (STRIDE-only journal can't replay.) */
let agenticRecorded = false;
try {
  const { loadJournal } = await import("./helpers/replay-ai.js");
  const { THREAT_ANALYSIS_SYSTEM_PROMPT } = await import(
    "../services/ai/prompts/threat-prompts.js"
  );
  const { PASTA_SYSTEM_PROMPT } = await import(
    "../services/ai/prompts/methodologies/index.js"
  );
  const journal = loadJournal(JOURNAL_PATH);
  const prompts = journal.map((e) => e.prompt);
  // Agentic was recorded iff both the STRIDE agentic system prompt AND the
  // PASTA system prompt appear (PASTA is unique to the agentic/methodology path).
  agenticRecorded =
    prompts.some((p) => p.startsWith(THREAT_ANALYSIS_SYSTEM_PROMPT)) &&
    prompts.some((p) => p.startsWith(PASTA_SYSTEM_PROMPT));
} catch {
  agenticRecorded = false;
}

if (!agenticRecorded) {
  // eslint-disable-next-line no-restricted-syntax -- test-time skip notice
  console.warn(
    "\nSKIPPED — agentic/multi-methodology prompts are NOT in the " +
      "committed journal. Record them: `npx tsx scripts/record-parity-journal.ts " +
      "--agentic-only` against LM Studio, then commit llm-journal.json. " +
      "Agentic parity is UNVERIFIED until then.\n",
  );
}

describe.skipIf(!agenticRecorded)(
  "agentic parity: legacy vs agentic-analysis-v2 pipeline",
  () => {
    let prisma: PrismaClient;
    let userId: string;
    let organizationId: string;
    let threatModelId: string;

    beforeAll(async () => {
      process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
      const { setupTestDatabase, testData } = await import("./setup.js");
      prisma = await setupTestDatabase();

      const user = await testData.createUser();
      const org = await testData.createOrganization();
      await testData.createMembership(user.id, org.id);
      const project = await testData.createProject(org.id, user.id);
      const model = await testData.createThreatModel(project.id, user.id, {
        name: "Agentic Parity",
      });
      userId = user.id;
      organizationId = org.id;
      threatModelId = model.id;

      const { seedAgenticAnalysisV2Pipeline } = await import(
        "../../scripts/seed-pipelines.js"
      );
      await seedAgenticAnalysisV2Pipeline(prisma);
    }, 120_000);

    afterAll(async () => {
      const { teardownTestDatabase } = await import("./setup.js");
      await teardownTestDatabase();
    });

    it("produces a parity-equal threat set both ways (replay AI)", async () => {
      const context = loadFixtureContext(FIXTURES_DIR);
      const replayCaller = createReplayAICaller(JOURNAL_PATH, "replay");

      // --- Legacy path (flag-off worker drives this) ---
      const { runAgenticAnalysis } = await import(
        "../services/ai/agentic-analysis.js"
      );
      const legacy: AgenticAnalysisResult = await runAgenticAnalysis(
        replayClient(replayCaller),
        context,
      );

      // --- v2 pipeline path (the exact function the flag-on worker calls) ---
      const { runAgenticAnalysisV2 } = await import(
        "../services/ai/agentic-analysis-v2.js"
      );
      const v2: AgenticAnalysisResult = await runAgenticAnalysisV2({
        prisma,
        context,
        userId,
        organizationId,
        threatModelId,
        aiCall: replayCaller,
      });

      // Both paths produced threats; compare as ADR-006 sets.
      expect(legacy.threats.length).toBeGreaterThan(0);
      expect(v2.threats).toHaveLength(legacy.threats.length);

      const report = compareThreatSets(
        legacy.threats.map(toThreatLike),
        v2.threats.map(toThreatLike),
      );
      expect(report.onlyInA).toEqual([]);
      expect(report.onlyInB).toEqual([]);
      expect(report.severityDrift).toEqual([]);
      expect(report.mitigationDrift).toEqual([]);
      expect(report.pass).toBe(true);

      // Result-shape contract (AiJob.result): same keys; summary equal modulo
      // wall-clock durations. The frontend poller parses this identically.
      expect(Object.keys(v2).sort()).toEqual(Object.keys(legacy).sort());
      expect(v2.summary.totalThreats).toBe(legacy.summary.totalThreats);
      expect(v2.summary.frameworksUsed).toEqual(legacy.summary.frameworksUsed);
      expect(v2.summary.componentsCovered).toBe(
        legacy.summary.componentsCovered,
      );
      expect(v2.summary.categoryCoverage).toEqual(
        legacy.summary.categoryCoverage,
      );

      // --- Acceptance: all four methodologies visible in the flow ---
      const pipeline = await prisma.promptPipeline.findFirstOrThrow({
        where: { name: "agentic-analysis-v2", isBuiltIn: true },
      });
      const executions = await prisma.pipelineExecution.findMany({
        where: { pipelineId: pipeline.id, threatModelId },
        include: { stageExecutions: { include: { stage: true } } },
      });
      expect(executions).toHaveLength(1);
      expect(executions[0].status).toBe("COMPLETED");

      const completedStageNames = executions[0].stageExecutions
        .filter((s) => s.status === "COMPLETED")
        .map((s) => s.stage.name);
      // STRIDE + PASTA + Kill Chain + MITRE children all ran.
      for (const name of METHODOLOGY_STAGES) {
        expect(completedStageNames).toContain(name);
      }
      // The verify-loop slot ran too (re-used across loops via upsert).
      expect(completedStageNames).toContain("Verify");
    }, 120_000);

    it("flag OFF leaves the legacy agentic path untouched (no pipeline rows)", async () => {
      // Spy-prove: the legacy path never touches PipelineExecution. We run the
      // legacy orchestrator directly (what the flag-off worker does) and assert
      // it created no execution rows for this model beyond the v2 run above is
      // isolated — here we count executions before/after a legacy-only call.
      const context = loadFixtureContext(FIXTURES_DIR);
      const replayCaller = createReplayAICaller(JOURNAL_PATH, "replay");

      const { runAgenticAnalysis } = await import(
        "../services/ai/agentic-analysis.js"
      );

      const before = await prisma.pipelineExecution.count();
      const legacy = await runAgenticAnalysis(
        replayClient(replayCaller),
        context,
      );
      const after = await prisma.pipelineExecution.count();

      expect(legacy.threats.length).toBeGreaterThan(0);
      // The legacy path writes NO PipelineExecution / PipelineStageExecution
      // rows — it is the untouched bespoke orchestrator.
      expect(after).toBe(before);
    }, 120_000);

    it("throws ReplayMiss for an un-recorded prompt (journal integrity)", async () => {
      const replayCaller = createReplayAICaller(JOURNAL_PATH, "replay");
      await expect(
        replayCaller("nonexistent system", "nonexistent user"),
      ).rejects.toBeInstanceOf(ReplayMiss);
    });
  },
);
