/**
 * T-05 — ATTACK_CHAIN_ANALYSIS must not wipe existing AI_SUGGESTED
 * attack chains when the LLM output is malformed/empty.
 *
 * Register finding: the wipe (`prisma.attackChain.deleteMany({threatModelId,
 * status: "AI_SUGGESTED"})`) ran unconditionally before the new chains were
 * persisted, with no guard on `chains.length` — so a malformed LLM reply
 * (generateAttackChains fails soft, returning `{ chains: [] }`) deleted the
 * existing AI-suggested chains and replaced them with nothing.
 *
 * Follows the mock/setup pattern in refresh-mitigations.test.ts (SQLite test
 * DB via ../test/setup.js, createJobAIClient mocked via vi.mock).
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

describe("T-05 — ATTACK_CHAIN_ANALYSIS leaves existing chains untouched on malformed LLM output", () => {
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
      slug: `attack-chain-wipe-${Date.now()}`,
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

  async function seedModelWithAttackChain() {
    const model = await prisma.threatModel.create({
      data: {
        name: "Attack Chain Wipe Test Model",
        projectId,
        createdById: userId,
      },
    });
    const component = await prisma.component.create({
      data: {
        threatModelId: model.id,
        nodeId: "node-gw",
        type: "PROCESS",
        name: "API Gateway",
        positionX: 0,
        positionY: 0,
      },
    });
    const chain = await prisma.attackChain.create({
      data: {
        threatModelId: model.id,
        name: "Existing AI-suggested chain",
        description: "A previously generated attack path.",
        severity: "HIGH",
        status: "AI_SUGGESTED",
        sessionId: "prior-session",
        entryPointId: component.id,
        entryPointName: component.name,
        targetAssetId: component.id,
        targetAssetName: component.name,
        hops: {
          create: [
            {
              position: 1,
              componentId: component.id,
              componentName: component.name,
              description: "Attacker reaches the gateway.",
            },
          ],
        },
      },
    });
    return { model, chain };
  }

  it("malformed LLM reply leaves the existing AI_SUGGESTED chain untouched and marks the job failed", async () => {
    completeMock.mockReset();
    completeMock.mockResolvedValue({
      content: "Sorry, I can't help with that.",
      usage: { totalTokens: 0 },
    });

    const { model, chain } = await seedModelWithAttackChain();
    const job = await prisma.aiJob.create({
      data: {
        userId,
        organizationId,
        type: "ATTACK_CHAIN_ANALYSIS",
        threatModelId: model.id,
        input: JSON.stringify({}),
      },
    });

    // processAiJob marks the job row FAILED and then rethrows (BullMQ worker
    // contract) — the failure must surface, not be swallowed.
    await expect(
      processAiJob({
        type: "ATTACK_CHAIN_ANALYSIS",
        userId,
        organizationId,
        threatModelId: model.id,
        input: JSON.stringify({}),
        dbJobId: job.id,
      }),
    ).rejects.toThrow();

    // The existing AI_SUGGESTED chain must still exist, unchanged.
    const survivingChains = await prisma.attackChain.findMany({
      where: { threatModelId: model.id },
    });
    expect(survivingChains).toHaveLength(1);
    expect(survivingChains[0].id).toBe(chain.id);
    expect(survivingChains[0].name).toBe("Existing AI-suggested chain");

    // The job must record a failure, not silent success with zero chains.
    const row = await prisma.aiJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(row.status).toBe("FAILED");
  });
});
