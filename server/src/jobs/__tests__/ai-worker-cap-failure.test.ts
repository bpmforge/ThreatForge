/**
 * Hitting PIPELINE_COMPONENT_CAP mid-run must mark the job
 * FAILED WITHOUT wiping threats already streamed to the DB for earlier
 * components in this same run.
 *
 * Before this fix, ai-worker.ts's outer catch called
 * cleanupSessionThreats(dbJobId) on every non-cancelled failure, including
 * the cap throw — deleting every AI_SUGGESTED/PENDING/unedited threat
 * carrying this run's session id, streamed components included. The fix
 * mirrors the AllUnitsFailedError mechanism: pipeline.ts's
 * ComponentCapExceededError carries `.code === "COMPONENT_CAP_EXCEEDED"`,
 * and ai-worker.ts recognises it to skip cleanup.
 *
 * runMicroAnalysis is mocked directly (pattern from
 * ai-worker-provider-failure.test.ts) so this test isolates the ai-worker.ts
 * failure-handling contract from the pipeline internals already covered by
 * pipeline-cap-failure.test.ts.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = resolve(__dirname, "../../../prisma/test-cap.db");

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

describe("SUGGEST_THREATS: PIPELINE_COMPONENT_CAP hit mid-run", () => {
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
      slug: `cap-failure-${Date.now()}`,
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

  it("marks the job FAILED and keeps threats already streamed for earlier components this run", async () => {
    runMicroAnalysisMock.mockReset();

    const model = await prisma.threatModel.create({
      data: {
        name: "Cap Failure Test Model",
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

    // Simulates a component streamed successfully earlier in THIS run,
    // before a later component blew the cap — exactly the shape
    // cleanupSessionThreats would otherwise delete.
    const streamedThreat = await prisma.threat.create({
      data: {
        threatModelId: model.id,
        createdById: userId,
        name: "Streamed threat from an earlier component this run",
        description: "Must survive a cap-exceeded run.",
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
          'Anomaly cap exceeded: component "Component 2" emitted 41 threats in this run (cap: 40). Aborting to prevent runaway accumulation.',
        ),
        { code: "COMPONENT_CAP_EXCEEDED", name: "ComponentCapExceededError" },
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
    // Default ruling: no COMPLETED-with-warning state exists on AiJobStatus
    // (QUEUED/PROCESSING/PAUSED/COMPLETED/FAILED/CANCELLED) — FAILED with a
    // clear `error` message is the closest existing state.
    expect(row.status).toBe("FAILED");
    expect(row.error).toContain("Anomaly cap exceeded");

    const survivors = await prisma.threat.findMany({
      where: { threatModelId: model.id },
    });
    expect(survivors).toHaveLength(1);
    expect(survivors[0].id).toBe(streamedThreat.id);
  });
});
