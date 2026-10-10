/**
 * A provider that fails on every call for a whole SUGGEST_THREATS
 * run must mark the job FAILED WITHOUT wiping already-persisted threats.
 *
 * ai-worker.ts's outer catch calls cleanupSessionThreats(dbJobId) on any
 * non-cancelled failure — correct for the per-component-cap case
 * (partial writes from THIS run) but wrong here: when every unit failed,
 * nothing new was persisted, and pre-existing threats tagged with this same
 * job/session id (e.g. a retry of a job id, or any row that legitimately
 * carries it) must not be swept away by a failure that produced nothing of
 * its own to clean up.
 *
 * runMicroAnalysis is mocked directly (pattern from ai-worker.test.ts) to
 * reject with the typed AllUnitsFailedError (code ALL_UNITS_FAILED) — this
 * isolates the ai-worker.ts failure-handling contract from the pipeline
 * internals already covered by pipeline-retry-failure.test.ts and
 * category-analyzer.test.ts.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = resolve(__dirname, "../../../prisma/test.db");

const { runMicroAnalysisMock } = vi.hoisted(() => ({
  runMicroAnalysisMock: vi.fn(),
}));

vi.mock("../../services/ai/micro-analysis/index.js", () => ({
  runMicroAnalysis: runMicroAnalysisMock,
}));

vi.mock("../job-ai-client.js", () => ({
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

describe("SUGGEST_THREATS: provider always fails", () => {
  let prisma: PrismaClient;
  let userId: string;
  let organizationId: string;
  let projectId: string;
  let processAiJob: (
    data: import("../ai-queue.js").AiJobData,
  ) => Promise<unknown>;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
    const { setupTestDatabase, testData } = await import("../../test/setup.js");
    prisma = await setupTestDatabase();

    const user = await testData.createUser();
    userId = user.id;
    const org = await testData.createOrganization({
      slug: `provider-failure-${Date.now()}`,
    });
    organizationId = org.id;
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        aiSettings: JSON.stringify({
          enabled: true,
          provider: "ollama",
          features: {
            autoSuggestThreats: false,
            autoSuggestMitigations: false,
            enableChat: false,
          },
          guardrails: {
            monthlyBudget: 0,
            anonymizeData: false,
            logInteractions: true,
          },
        }),
      },
    });
    await testData.createMembership(userId, organizationId);
    const project = await testData.createProject(organizationId, userId);
    projectId = project.id;

    ({ processAiJob } = await import("../ai-worker.js"));
  }, 120_000);

  afterAll(async () => {
    const { teardownTestDatabase } = await import("../../test/setup.js");
    await teardownTestDatabase();
  });

  it("marks the job FAILED and keeps a pre-existing threat tagged with this run's session id", async () => {
    runMicroAnalysisMock.mockReset();

    const model = await prisma.threatModel.create({
      data: {
        name: "Provider Failure Test Model",
        projectId,
        createdById: userId,
      },
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

    // Worst case for the cleanup-scoping concern: a threat that already
    // carries THIS job's id as its analysisSessionId (e.g. left over from
    // an earlier successful component in the same run/session), AI_SUGGESTED
    // + PENDING + unedited — exactly the shape cleanupSessionThreats deletes.
    const priorThreat = await prisma.threat.create({
      data: {
        threatModelId: model.id,
        createdById: userId,
        name: "Pre-existing threat from an earlier successful component",
        description: "Must survive an all-units-failed run.",
        severity: "HIGH",
        source: "AI_SUGGESTED",
        reviewStatus: "PENDING",
        manuallyEdited: false,
        analysisSessionId: job.id,
        strideCategories: JSON.stringify(["TAMPERING"]),
        cweIds: JSON.stringify([]),
        owaspIds: JSON.stringify([]),
      },
    });

    runMicroAnalysisMock.mockRejectedValueOnce(
      Object.assign(
        new Error(
          "Micro-analysis produced no threats: all 6 attempted unit(s) failed (provider errors).",
        ),
        { code: "ALL_UNITS_FAILED", name: "AllUnitsFailedError" },
      ),
    );

    await expect(
      processAiJob({
        type: "SUGGEST_THREATS",
        userId,
        organizationId,
        threatModelId: model.id,
        input: JSON.stringify({ mode: "micro" }),
        dbJobId: job.id,
      }),
    ).rejects.toThrow();

    const row = await prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(row.status).toBe("FAILED");

    const survivors = await prisma.threat.findMany({
      where: { threatModelId: model.id },
    });
    expect(survivors).toHaveLength(1);
    expect(survivors[0].id).toBe(priorThreat.id);
  });
});
