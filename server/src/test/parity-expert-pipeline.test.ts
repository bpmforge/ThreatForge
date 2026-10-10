/**
 * Expert-mode parity gate: legacy 6-pass vs expert-analysis-v2 pipeline.
 *
 * Both paths run the SAME 6 expert passes on the go-forward fixture with the
 * committed replay journal (zero network — any prompt drift throws
 * ReplayMiss):
 * - legacy: runExpertAnalysis(client, context) — exactly what the flag-off
 *   worker drives (the AIProviderClient.complete here delegates to the replay
 *   AICallFn so both paths hit the same journal hashes).
 * - v2: runExpertAnalysisV2 — the function the flag-on worker calls; drives
 *   the seeded expert-analysis-v2 PromptTemplate-backed stages and writes
 *   PipelineExecution + PipelineStageExecution rows.
 *
 * Compared with the parity comparator on the ADR-006 key (set semantics,
 * order-independent). The expert path stores its report in AiJob.result only
 * (no Threat rows), so this compares the in-memory ExpertAnalysisResult.threats.
 * It also asserts the run is visible in PipelineExecution rows.
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
  ExpertAnalysisResult,
  ExpertThreat,
} from "../services/ai/expert-analysis.js";
import { loadFixtureContext } from "./helpers/fixture-context.js";
import { compareThreatSets, type ThreatLike } from "./helpers/parity.js";
import { createReplayAICaller } from "./helpers/replay-ai.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures", "go-forward");
const JOURNAL_PATH = join(FIXTURES_DIR, "llm-journal.json");
const TEST_DB_PATH = resolve(__dirname, "../../prisma/test.db");

/** Map an ExpertThreat to the comparator's ThreatLike shape (ADR-006 key). */
function toThreatLike(t: ExpertThreat): ThreatLike {
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

/** AIProviderClient whose complete() delegates to a replay AICallFn (system +
 *  user messages only — the expert passes never send multimodal content). */
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

describe("expert parity: legacy vs expert-analysis-v2 pipeline", () => {
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
      name: "Expert Parity",
    });
    userId = user.id;
    organizationId = org.id;
    threatModelId = model.id;

    const { seedExpertAnalysisV2Pipeline } = await import(
      "../../scripts/seed-pipelines.js"
    );
    await seedExpertAnalysisV2Pipeline(prisma);
  }, 120_000);

  afterAll(async () => {
    const { teardownTestDatabase } = await import("./setup.js");
    await teardownTestDatabase();
  });

  it("produces a parity-equal threat set both ways (replay AI)", async () => {
    const context = loadFixtureContext(FIXTURES_DIR);
    const replayCaller = createReplayAICaller(JOURNAL_PATH, "replay");

    // --- Legacy path (flag-off worker drives this) ---
    const { runExpertAnalysis } = await import(
      "../services/ai/expert-analysis.js"
    );
    const legacy: ExpertAnalysisResult = await runExpertAnalysis(
      replayClient(replayCaller),
      context,
    );

    // --- v2 pipeline path (the exact function the flag-on worker calls) ---
    const { runExpertAnalysisV2 } = await import(
      "../services/ai/expert-analysis-v2.js"
    );
    const v2: ExpertAnalysisResult = await runExpertAnalysisV2({
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

    // Result-shape contract (AiJob.result): same keys, same summary modulo
    // wall-clock. The frontend poller parses this identically.
    expect(Object.keys(v2).sort()).toEqual(Object.keys(legacy).sort());
    expect({ ...v2.summary, duration: 0 }).toEqual({
      ...legacy.summary,
      duration: 0,
    });
    expect(v2.architectureUnderstanding).toBe(legacy.architectureUnderstanding);
    expect(v2.dataFlowFindings).toBe(legacy.dataFlowFindings);
    expect(v2.attackChains).toBe(legacy.attackChains);

    // --- Acceptance: execution visible in PipelineExecution rows ---
    const pipeline = await prisma.promptPipeline.findFirstOrThrow({
      where: { name: "expert-analysis-v2", isBuiltIn: true },
    });
    const executions = await prisma.pipelineExecution.findMany({
      where: { pipelineId: pipeline.id, threatModelId },
      include: { stageExecutions: true },
    });
    expect(executions).toHaveLength(1);
    expect(executions[0].status).toBe("COMPLETED");
    // 5 LLM-pass stage rows + ≥1 verify-loop row reuse + the code Consolidate
    // row: at least 6 stage executions recorded.
    expect(executions[0].stageExecutions.length).toBeGreaterThanOrEqual(6);
    expect(
      executions[0].stageExecutions.every((s) => s.status === "COMPLETED"),
    ).toBe(true);
  }, 120_000);
});
