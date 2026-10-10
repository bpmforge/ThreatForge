/**
 * SUGGEST_THREATS worker routing by the `agent-chain-v2` org flag.
 *
 * Proves the rollout contract:
 * - flag OFF (default) → the legacy micro path runs and pipeline-service is
 *   NEVER called (spy) — legacy behavior is unchanged.
 * - flag ON → the job executes via threat-analysis-v2 through
 *   pipeline-service.executePipeline; the legacy runMicroAnalysis is NEVER
 *   called; the final AiJob row carries the same MicroAnalysisResult shape
 *   (worker's shared COMPLETED block) and the ADR-006 session-tagged persist
 *   wrote the calibrated set.
 *
 * Runs against the real SQLite test DB (worker reads org settings / job rows
 * from the DB); only the LLM boundary (job-ai-client), the legacy pipeline,
 * and pipeline-service are mocked.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import type { MicroThreat } from "../services/ai/micro-analysis/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = resolve(__dirname, "../../prisma/test.db");

// --- Mocks (hoisted) -------------------------------------------------------

const {
  runMicroAnalysisMock,
  executePipelineMock,
  runExpertAnalysisMock,
  runExpertAnalysisV2Mock,
} = vi.hoisted(() => ({
  runMicroAnalysisMock: vi.fn(),
  executePipelineMock: vi.fn(),
  runExpertAnalysisMock: vi.fn(async () => ({
    threats: [],
    summary: { totalThreats: 0 },
  })),
  runExpertAnalysisV2Mock: vi.fn(async () => ({
    threats: [],
    summary: { totalThreats: 0 },
  })),
}));

vi.mock("../services/ai/micro-analysis/index.js", () => ({
  runMicroAnalysis: runMicroAnalysisMock,
}));

vi.mock("../services/ai/pipeline-service.js", () => ({
  executePipeline: executePipelineMock,
  clearPipelineCache: vi.fn(),
}));

vi.mock("../services/ai/expert-analysis.js", async (importOriginal) => {
  // Keep the real prompt constants / template ids / helpers (seed-pipelines.ts
  // imports them) — only the orchestrator entry point is stubbed.
  const actual =
    await importOriginal<typeof import("../services/ai/expert-analysis.js")>();
  return { ...actual, runExpertAnalysis: runExpertAnalysisMock };
});

vi.mock("../services/ai/expert-analysis-v2.js", () => ({
  runExpertAnalysisV2: runExpertAnalysisV2Mock,
}));

vi.mock("./job-ai-client.js", () => ({
  createJobAIClient: vi.fn(async () => ({
    client: {
      complete: vi.fn(async () => ({
        content: "[]",
        usage: { totalTokens: 0 },
      })),
      isAvailable: async () => true,
    },
    orgSettings: { enabled: true, provider: "ollama" },
  })),
}));

// --- Fixtures ---------------------------------------------------------------

function aiSettingsJson(agentChainV2: boolean): string {
  return JSON.stringify({
    enabled: true,
    provider: "ollama",
    features: {
      autoSuggestThreats: false,
      autoSuggestMitigations: false,
      enableChat: false,
      agentChainV2,
    },
    guardrails: {
      monthlyBudget: 0,
      anonymizeData: false,
      logInteractions: true,
    },
  });
}

const microThreat: MicroThreat = {
  name: "Spoofed admin session on API Gateway",
  description:
    "An attacker reuses a stolen session token to impersonate an admin.",
  category: "SPOOFING",
  severity: "HIGH",
  componentId: "node-gw",
  componentName: "API Gateway",
  cweIds: ["CWE-287"],
  owaspIds: ["A07:2021"],
  evidence: { attackPath: "Steal token, replay against /admin." },
  mitigations: [],
  mitigation: {
    description: "Bind sessions to client",
    effort: "medium",
    effectiveness: "0.6",
  },
  confidence: 0.9,
  sourceMethodology: "stride",
};

const legacyResult = {
  threats: [microThreat],
  attackChains: [],
  compoundThreats: [],
  parseFailures: [],
  summary: {
    totalThreats: 1,
    componentsAnalyzed: 1,
    categoriesPerComponent: 6,
    categoryCoverage: { SPOOFING: 1 },
    componentsCovered: 1,
    totalComponents: 1,
    llmCalls: 6,
    duration: 10,
    skippedComponentCount: 0,
    parseFailures: 0,
  },
};

/** Canned COMPLETED pipeline run carrying the v2 ride-along outputs. */
function cannedPipelineResult() {
  return {
    executionId: "exec-routing-test",
    status: "COMPLETED",
    outputs: {},
    finalResult: undefined,
    totalDurationMs: 5,
    totalTokensUsed: 0,
    stageResults: [
      {
        stageId: "s-ar",
        stageName: "ArchitectureReader",
        status: "COMPLETED",
        output: { parseFailures: [] },
      },
      {
        stageId: "s-ti",
        stageName: "ThreatIdentifier",
        status: "COMPLETED",
        output: {
          threats: [microThreat],
          parseFailures: [],
          attackChains: [],
          llmCalls: 6,
          skippedComponentCount: 0,
        },
      },
      {
        stageId: "s-sc",
        stageName: "SeverityCalibrator",
        status: "COMPLETED",
        output: {
          calibratedThreats: [microThreat],
          llmCalls: 1,
          parseFailures: [],
        },
      },
    ],
  };
}

// --- Suite -------------------------------------------------------------------

describe("SUGGEST_THREATS routing by agent-chain-v2 flag", () => {
  let prisma: PrismaClient;
  let userId: string;
  let projectId: string;
  let orgOffId: string;
  let orgOnId: string;
  let processAiJob: (
    data: import("./ai-queue.js").AiJobData,
  ) => Promise<unknown>;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
    const { setupTestDatabase, testData } = await import("../test/setup.js");
    prisma = await setupTestDatabase();

    const user = await testData.createUser();
    userId = user.id;
    const orgOff = await testData.createOrganization({
      slug: `off-${Date.now()}`,
    });
    const orgOn = await testData.createOrganization({
      slug: `on-${Date.now()}`,
    });
    orgOffId = orgOff.id;
    orgOnId = orgOn.id;
    await prisma.organization.update({
      where: { id: orgOffId },
      data: { aiSettings: aiSettingsJson(false) },
    });
    await prisma.organization.update({
      where: { id: orgOnId },
      data: { aiSettings: aiSettingsJson(true) },
    });
    await testData.createMembership(userId, orgOffId);
    const project = await testData.createProject(orgOffId, userId);
    projectId = project.id;

    // The flag-on path resolves the seeded pipeline by name.
    const { seedThreatAnalysisV2Pipeline, seedExpertAnalysisV2Pipeline } =
      await import("../../scripts/seed-pipelines.js");
    await seedThreatAnalysisV2Pipeline(prisma);
    await seedExpertAnalysisV2Pipeline(prisma);

    ({ processAiJob } = await import("./ai-worker.js"));
  }, 120_000);

  afterAll(async () => {
    const { teardownTestDatabase } = await import("../test/setup.js");
    await teardownTestDatabase();
  });

  async function makeJob(organizationId: string) {
    const model = await prisma.threatModel.create({
      data: { name: "Routing Test Model", projectId, createdById: userId },
    });
    const job = await prisma.aiJob.create({
      data: {
        userId,
        organizationId,
        type: "SUGGEST_THREATS",
        threatModelId: model.id,
        input: JSON.stringify({ mode: "micro" }),
      },
    });
    return { model, job };
  }

  it("flag OFF → legacy micro path runs; pipeline-service is never called", async () => {
    runMicroAnalysisMock.mockResolvedValueOnce(legacyResult);
    const { job, model } = await makeJob(orgOffId);

    await processAiJob({
      type: "SUGGEST_THREATS",
      userId,
      organizationId: orgOffId,
      threatModelId: model.id,
      input: JSON.stringify({ mode: "micro" }),
      dbJobId: job.id,
    });

    expect(runMicroAnalysisMock).toHaveBeenCalledTimes(1);
    expect(executePipelineMock).not.toHaveBeenCalled();

    const row = await prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(row.status).toBe("COMPLETED");
    expect(row.progress).toBe(100);
    const stored = JSON.parse(row.result!);
    expect(stored.summary.totalThreats).toBe(1);
  });

  it("flag ON → threat-analysis-v2 runs via pipeline-service; legacy path never called", async () => {
    runMicroAnalysisMock.mockClear();
    executePipelineMock.mockResolvedValueOnce(cannedPipelineResult());
    const { job, model } = await makeJob(orgOnId);

    await processAiJob({
      type: "SUGGEST_THREATS",
      userId,
      organizationId: orgOnId,
      threatModelId: model.id,
      input: JSON.stringify({ mode: "micro" }),
      dbJobId: job.id,
    });

    expect(executePipelineMock).toHaveBeenCalledTimes(1);
    expect(runMicroAnalysisMock).not.toHaveBeenCalled();

    // The pipeline was invoked with the seeded threat-analysis-v2 id and the
    // job-scoped ADR-006 session tag.
    const [pipelineInput, , runtime] = executePipelineMock.mock.calls[0];
    const seeded = await prisma.promptPipeline.findFirstOrThrow({
      where: { name: "threat-analysis-v2", isBuiltIn: true },
    });
    expect(pipelineInput.pipelineId).toBe(seeded.id);
    expect(pipelineInput.threatModelId).toBe(model.id);
    expect(runtime.sessionId).toBe(job.id);
    // StrideClassifier repair stays OFF by default (validate-only).
    expect(pipelineInput.inputMetadata.repairCategories).toBeUndefined();
    // Mitigations-only preseed wiring: options + persist reach the stages.
    expect(pipelineInput.inputMetadata.options.mitigationsOnly).toBe(false);
    expect(pipelineInput.inputMetadata.persist).toEqual({
      threatModelId: model.id,
      userId,
      sessionId: job.id,
    });

    // Job contract: same COMPLETED wrapper + MicroAnalysisResult shape.
    const row = await prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(row.status).toBe("COMPLETED");
    expect(row.progress).toBe(100);
    const stored = JSON.parse(row.result!);
    expect(Object.keys(stored).sort()).toEqual(
      [
        "threats",
        "attackChains",
        "compoundThreats",
        "parseFailures",
        "summary",
        "parseFailuresSamples",
      ].sort(),
    );
    expect(stored.summary.totalThreats).toBe(1);

    // Real ADR-006 persistence ran for the flag-on path (session-tagged row).
    const persisted = await prisma.threat.findMany({
      where: { threatModelId: model.id },
    });
    expect(persisted).toHaveLength(1);
    expect(persisted[0].analysisSessionId).toBe(job.id);
    expect(persisted[0].source).toBe("AI_SUGGESTED");
    expect(persisted[0].reviewStatus).toBe("PENDING");
  });

  it("flag OFF + mode=expert → legacy expert path; v2 never called", async () => {
    runMicroAnalysisMock.mockClear();
    executePipelineMock.mockClear();
    runExpertAnalysisMock.mockClear();
    runExpertAnalysisV2Mock.mockClear();
    const { job, model } = await makeJob(orgOffId);

    await processAiJob({
      type: "SUGGEST_THREATS",
      userId,
      organizationId: orgOffId,
      threatModelId: model.id,
      input: JSON.stringify({ mode: "expert" }),
      dbJobId: job.id,
    });

    // Legacy 6-pass orchestrator runs, byte-untouched; the v2 pipeline path
    // and the micro pipeline are never reached.
    expect(runExpertAnalysisMock).toHaveBeenCalledTimes(1);
    expect(runExpertAnalysisV2Mock).not.toHaveBeenCalled();
    expect(executePipelineMock).not.toHaveBeenCalled();
    expect(runMicroAnalysisMock).not.toHaveBeenCalled();
  });

  it("flag ON + mode=expert → expert-analysis-v2 pipeline; legacy expert never called", async () => {
    runMicroAnalysisMock.mockClear();
    executePipelineMock.mockClear();
    runExpertAnalysisMock.mockClear();
    runExpertAnalysisV2Mock.mockClear();
    const { job, model } = await makeJob(orgOnId);

    await processAiJob({
      type: "SUGGEST_THREATS",
      userId,
      organizationId: orgOnId,
      threatModelId: model.id,
      input: JSON.stringify({ mode: "expert" }),
      dbJobId: job.id,
    });

    expect(runExpertAnalysisV2Mock).toHaveBeenCalledTimes(1);
    expect(runExpertAnalysisMock).not.toHaveBeenCalled();
    // The micro-only threat-analysis-v2 pipeline path is NOT used for expert.
    expect(executePipelineMock).not.toHaveBeenCalled();
    expect(runMicroAnalysisMock).not.toHaveBeenCalled();

    // v2 was handed the job-scoped identifiers + an aiCall.
    const callArg = (runExpertAnalysisV2Mock.mock.calls[0] as unknown[])[0] as {
      organizationId: string;
      threatModelId: string;
      userId: string;
      aiCall: unknown;
    };
    expect(callArg.organizationId).toBe(orgOnId);
    expect(callArg.threatModelId).toBe(model.id);
    expect(callArg.userId).toBe(userId);
    expect(typeof callArg.aiCall).toBe("function");
  });
});
