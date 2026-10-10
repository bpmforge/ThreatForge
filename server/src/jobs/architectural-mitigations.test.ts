/**
 * ARCHITECTURAL_MITIGATIONS job — mock-provider tests.
 *
 * Follows attack-chain-wipe.test.ts: SQLite test DB, createJobAIClient mocked.
 * Core invariants: ids are validated against the model, MODIFIED/ACCEPTED/
 * REJECTED/HUMAN rows are never overwritten or deleted by an AI run, and a
 * malformed reply fails the job without touching existing rows.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import {
  planArchitecturalMitigationWrite,
  SHARED_CONTROL_MARKER,
} from "../services/ai/architectural-mitigation-service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = resolve(__dirname, "../../prisma/test.db");

const { completeMock } = vi.hoisted(() => ({ completeMock: vi.fn() }));

vi.mock("./job-ai-client.js", () => ({
  createJobAIClient: vi.fn(async () => ({
    client: { complete: completeMock, isAvailable: async () => true },
    orgSettings: { enabled: true, provider: "ollama" },
  })),
}));

describe("planArchitecturalMitigationWrite", () => {
  const mk = (
    id: string,
    status: string,
    source: string,
    kind = "ADD_WAF",
  ) => ({
    id,
    kind,
    status,
    source,
    affectedComponentIds: '["c1"]',
    affectedConnectionIds: "[]",
  });
  const proposal = (kind: "ADD_WAF" | "OTHER") => ({
    kind,
    title: "t",
    proposedChange: "p",
    rationale: null,
    affectedComponentIds: ["c1"],
    affectedConnectionIds: [],
    threatIds: ["x"],
    attackChainIds: [],
    priority: "HIGH" as const,
  });

  it("never deletes the duplicate guard's shared-control rows (the threat run owns them)", () => {
    const guardRow = {
      ...mk("guard", "AI_SUGGESTED", "AI", "OTHER"),
      rationale: `${SHARED_CONTROL_MARKER} One control closes 3 threats`,
    };
    const plan = planArchitecturalMitigationWrite(
      [guardRow, { ...mk("llm", "AI_SUGGESTED", "AI"), rationale: "x" }],
      [proposal("ADD_WAF")],
    );
    expect(plan.deleteIds).toEqual(["llm"]);
  });

  it("only AI_SUGGESTED AI rows are replaceable", () => {
    const plan = planArchitecturalMitigationWrite(
      [
        mk("a", "AI_SUGGESTED", "AI"),
        mk("b", "MODIFIED", "HUMAN"),
        mk("c", "ACCEPTED", "AI"),
        mk("d", "AI_SUGGESTED", "HUMAN"),
      ],
      [proposal("OTHER")],
    );
    expect(plan.deleteIds).toEqual(["a"]);
  });

  it("drops new proposals that duplicate a human-reviewed row", () => {
    const plan = planArchitecturalMitigationWrite(
      [mk("r", "REJECTED", "AI")],
      [proposal("ADD_WAF"), proposal("OTHER")],
    );
    expect(plan.create.map((p) => p.kind)).toEqual(["OTHER"]);
  });
});

describe("ARCHITECTURAL_MITIGATIONS worker", () => {
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
      slug: `arch-mit-${Date.now()}`,
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
    projectId = (await testData.createProject(organizationId, userId)).id;
    ({ processAiJob } = await import("./ai-worker.js"));
  }, 120_000);

  afterAll(async () => {
    const { teardownTestDatabase } = await import("../test/setup.js");
    await teardownTestDatabase();
  });

  async function seed() {
    const model = await prisma.threatModel.create({
      data: { name: "Arch Mit Model", projectId, createdById: userId },
    });
    const comp = await prisma.component.create({
      data: {
        threatModelId: model.id,
        nodeId: "node-gw",
        type: "PROCESS",
        name: "API Gateway",
        positionX: 0,
        positionY: 0,
      },
    });
    const threat = await prisma.threat.create({
      data: {
        threatModelId: model.id,
        name: "SQL injection at gateway",
        description: "d",
        category: "TAMPERING",
        severity: "HIGH",
        componentNodeId: "node-gw",
        createdById: userId,
      },
    });
    return { model, comp, threat };
  }

  async function run(modelId: string) {
    const job = await prisma.aiJob.create({
      data: {
        userId,
        organizationId,
        type: "ARCHITECTURAL_MITIGATIONS",
        threatModelId: modelId,
        input: "{}",
      },
    });
    return processAiJob({
      type: "ARCHITECTURAL_MITIGATIONS",
      userId,
      organizationId,
      threatModelId: modelId,
      input: "{}",
      dbJobId: job.id,
    });
  }

  it("persists validated proposals, dropping hallucinated ids and uncited items", async () => {
    const { model, comp, threat } = await seed();
    completeMock.mockReset();
    completeMock.mockResolvedValue({
      content: JSON.stringify([
        {
          kind: "ADD_WAF",
          title: "Add WAF",
          proposedChange: "WAF in front of the gateway",
          affectedComponentIds: [comp.id, "ghost-component"],
          threatIds: [threat.id, "ghost-threat"],
          priority: "high",
        },
        {
          kind: "SPLIT_COMPONENT",
          title: "Uncited",
          proposedChange: "cites no real threat",
          threatIds: ["ghost-threat"],
        },
      ]),
      usage: { totalTokens: 0 },
    });

    await run(model.id);

    const rows = await prisma.architecturalMitigation.findMany({
      where: { threatModelId: model.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "ADD_WAF",
      status: "AI_SUGGESTED",
      source: "AI",
      priority: "HIGH",
    });
    expect(JSON.parse(rows[0].affectedComponentIds)).toEqual([comp.id]);
    expect(JSON.parse(rows[0].threatIds)).toEqual([threat.id]);
  });

  it("re-analysis replaces AI_SUGGESTED but never touches MODIFIED/ACCEPTED/REJECTED rows", async () => {
    const { model, comp, threat } = await seed();
    const base = {
      threatModelId: model.id,
      proposedChange: "x",
      threatIds: JSON.stringify([threat.id]),
    };
    const mk = (
      title: string,
      status: "AI_SUGGESTED" | "MODIFIED" | "ACCEPTED" | "REJECTED",
      source: string,
      kind:
        | "ADD_WAF"
        | "ENCRYPT_CONNECTION"
        | "SPLIT_COMPONENT"
        | "ADD_TRUST_BOUNDARY",
    ) =>
      prisma.architecturalMitigation.create({
        data: { ...base, title, status, source, kind },
      });
    const stale = await mk(
      "stale ai",
      "AI_SUGGESTED",
      "AI",
      "ADD_TRUST_BOUNDARY",
    );
    const modified = await mk(
      "human edited",
      "MODIFIED",
      "HUMAN",
      "ENCRYPT_CONNECTION",
    );
    const accepted = await mk("accepted", "ACCEPTED", "AI", "SPLIT_COMPONENT");
    // REJECTED row with the same identity as what the LLM will propose again.
    const rejected = await prisma.architecturalMitigation.create({
      data: {
        ...base,
        title: "rejected waf",
        status: "REJECTED",
        source: "AI",
        kind: "ADD_WAF",
        affectedComponentIds: JSON.stringify([comp.id]),
      },
    });

    completeMock.mockReset();
    completeMock.mockResolvedValue({
      content: JSON.stringify([
        {
          kind: "ADD_WAF",
          title: "WAF again",
          proposedChange: "re-suggest",
          affectedComponentIds: [comp.id],
          threatIds: [threat.id],
        },
        {
          kind: "OTHER",
          title: "Network segmentation",
          proposedChange: "segment",
          threatIds: [threat.id],
        },
      ]),
      usage: { totalTokens: 0 },
    });

    await run(model.id);

    const rows = await prisma.architecturalMitigation.findMany({
      where: { threatModelId: model.id },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.has(stale.id)).toBe(false);
    expect(byId.get(modified.id)?.title).toBe("human edited");
    expect(byId.get(modified.id)?.status).toBe("MODIFIED");
    expect(byId.get(accepted.id)?.status).toBe("ACCEPTED");
    expect(byId.get(rejected.id)?.status).toBe("REJECTED");
    const fresh = rows.filter((r) => r.status === "AI_SUGGESTED");
    expect(fresh.map((r) => r.kind)).toEqual(["OTHER"]); // WAF not re-suggested
  });

  it("malformed reply fails the job and leaves existing rows untouched", async () => {
    const { model, threat } = await seed();
    const existing = await prisma.architecturalMitigation.create({
      data: {
        threatModelId: model.id,
        kind: "ADD_WAF",
        title: "keep me",
        proposedChange: "x",
        threatIds: JSON.stringify([threat.id]),
      },
    });
    completeMock.mockReset();
    completeMock.mockResolvedValue({
      content: "Sorry, I can't help with that.",
      usage: { totalTokens: 0 },
    });

    await expect(run(model.id)).rejects.toThrow();

    const rows = await prisma.architecturalMitigation.findMany({
      where: { threatModelId: model.id },
    });
    expect(rows.map((r) => r.id)).toEqual([existing.id]);
  });
});
