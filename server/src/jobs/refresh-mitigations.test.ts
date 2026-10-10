/**
 * T-04 — REFRESH_MITIGATIONS must not delete existing mitigations when
 * the LLM reply parses as JSON but has the wrong shape.
 *
 * Register finding: JSON.parse succeeds, the result is cast with no runtime
 * shape check, the per-mitigation delete loop runs, and createMany inserts
 * garbage — so a malformed-but-parseable reply silently wipes a threat's
 * mitigations. This test seeds a threat with an existing mitigation, mocks
 * createJobAIClient to return malformed text, and asserts the mitigation
 * survives and the job records a failure for that threat.
 *
 * Follows the mock/setup pattern in ai-worker.test.ts (SQLite test DB via
 * ../test/setup.js, createJobAIClient mocked via vi.mock).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = resolve(__dirname, "../../prisma/test.db");

const { completeMock } = vi.hoisted(() => ({
  completeMock: vi.fn(),
}));

vi.mock("./job-ai-client.js", () => ({
  createJobAIClient: vi.fn(async () => ({
    client: { complete: completeMock, isAvailable: async () => true },
    orgSettings: { enabled: true, provider: "ollama" },
  })),
}));

const MALFORMED_REPLIES = [
  "{}",
  "[null]",
  '[{"foo":1}]',
  "Sorry, I can't help with that.",
  "[]",
];

describe("T-04 — REFRESH_MITIGATIONS leaves mitigations untouched on malformed LLM output", () => {
  let prisma: PrismaClient;
  let userId: string;
  let organizationId: string;
  let projectId: string;
  let processAiJob: (
    data: import("./ai-queue.js").AiJobData,
  ) => Promise<unknown>;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
    const { setupTestDatabase, testData } = await import("../test/setup.js");
    prisma = await setupTestDatabase();

    const user = await testData.createUser();
    userId = user.id;
    const org = await testData.createOrganization({
      slug: `refresh-mit-${Date.now()}`,
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

    ({ processAiJob } = await import("./ai-worker.js"));
  }, 120_000);

  afterAll(async () => {
    const { teardownTestDatabase } = await import("../test/setup.js");
    await teardownTestDatabase();
  });

  async function seedThreatWithMitigation() {
    const model = await prisma.threatModel.create({
      data: {
        name: "Refresh Mitigations Test Model",
        projectId,
        createdById: userId,
      },
    });
    const threat = await prisma.threat.create({
      data: {
        name: "Spoofed admin session",
        threatModelId: model.id,
        source: "AI_SUGGESTED",
        reviewStatus: "PENDING",
        createdById: userId,
      },
    });
    const mitigation = await prisma.mitigation.create({
      data: {
        description: "Existing hand-verified mitigation",
        threatId: threat.id,
        source: "AI",
        status: "NOT_IMPLEMENTED",
        verified: false,
        createdById: userId,
      },
    });
    return { model, threat, mitigation };
  }

  it.each(MALFORMED_REPLIES)(
    "malformed reply %j leaves the existing mitigation untouched and reports a failure",
    async (malformedReply) => {
      completeMock.mockReset();
      completeMock.mockResolvedValue({
        content: malformedReply,
        usage: { totalTokens: 0 },
      });

      const { model, threat, mitigation } = await seedThreatWithMitigation();
      const job = await prisma.aiJob.create({
        data: {
          userId,
          organizationId,
          type: "REFRESH_MITIGATIONS",
          threatModelId: model.id,
          input: JSON.stringify({}),
        },
      });

      await processAiJob({
        type: "REFRESH_MITIGATIONS",
        userId,
        organizationId,
        threatModelId: model.id,
        input: JSON.stringify({}),
        dbJobId: job.id,
      });

      // The existing mitigation must still exist, unchanged.
      const survivingMitigations = await prisma.mitigation.findMany({
        where: { threatId: threat.id },
      });
      expect(survivingMitigations).toHaveLength(1);
      expect(survivingMitigations[0].id).toBe(mitigation.id);
      expect(survivingMitigations[0].description).toBe(
        "Existing hand-verified mitigation",
      );

      // The job result must reflect a failure for this threat, not silent success.
      const row = await prisma.aiJob.findUniqueOrThrow({
        where: { id: job.id },
      });
      expect(row.result).not.toBeNull();
      const stored = JSON.parse(row.result as string);
      expect(stored.threatsFailed).toBeGreaterThanOrEqual(1);
      expect(stored.threatsUpdated).toBe(0);
    },
  );
});
