/**
 * Verifier stage: challenger-gate unit + DB-backed tests.
 *
 * DB-free tests assert the gate DECISIONS (no persist → no DB) with a stubbed
 * aiCall, including that a topology-impossible threat is removed WITHOUT any
 * LLM call. The DB-backed test (real SQLite via setupTestDatabase) proves the
 * session-scoped deletion: a confidently-refuted AI_SUGGESTED row from THIS
 * session is deleted, while a human-ACCEPTED row with the SAME dedup key, and
 * an AI_SUGGESTED row from a DIFFERENT session, are both left untouched. It
 * also proves the additive migration applies on SQLite (challengeStatus /
 * verificationNote columns exist).
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { ThreatModelContext } from "../../../types/ai.js";
import type { MicroThreat } from "../micro-analysis/types.js";
import { normalizeThreatName } from "../../threat-review/normalize-threat-name.js";
import { registerStageHandlers } from "./index.js";
import { getStage, resetStageRegistry, type StageContext } from "./registry.js";
import { verifierStage, type VerifierInputs } from "./verifier.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = resolve(__dirname, "../../../../prisma/test.db");

function threat(overrides: Partial<MicroThreat> = {}): MicroThreat {
  return {
    name: "Token replay",
    description: "Attacker replays a captured token",
    category: "SPOOFING",
    severity: "HIGH",
    componentId: "api",
    componentName: "API Gateway",
    cweIds: [],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "MEDIUM", effectiveness: "0.5" },
    confidence: 0.8,
    sourceMethodology: "stride",
    ...overrides,
  };
}

const context: ThreatModelContext = {
  name: "TM",
  components: [
    { id: "api", type: "API", name: "API Gateway" },
    { id: "db", type: "DATABASE", name: "DB" },
  ],
  connections: [{ id: "edge-1", source: "api", target: "db" }],
  boundaries: [],
};

function makeCtx(
  inputs: Record<string, unknown>,
  aiCall: StageContext["aiCall"],
): StageContext {
  return {
    executionId: "exec-1",
    threatModelId: "tm-1",
    organizationId: "org-1",
    sessionId: "session-1",
    inputs,
    aiCall,
    progress: async () => undefined,
    checkpoint: async () => undefined,
    signal: new AbortController().signal,
  };
}

/** aiCall that echoes a fixed verdict for every threatRef in the prompt. */
function verdictStub(
  verdict: "CONFIRMED" | "REFUTED" | "UNCERTAIN",
  confidence: number,
  counter?: { n: number },
): StageContext["aiCall"] {
  return async (_system, user) => {
    if (counter) counter.n++;
    const refs = [...user.matchAll(/threatRef:\s*(.+)/g)].map((m) =>
      m[1].trim(),
    );
    return JSON.stringify(
      refs.map((threatRef) => ({
        threatRef,
        verdict,
        confidence,
        refutationReason: verdict === "CONFIRMED" ? undefined : "stub reason",
      })),
    );
  };
}

describe("Verifier stage — decisions (DB-free)", () => {
  beforeEach(() => resetStageRegistry());

  it("registers via stages/index.ts side-effect registration", () => {
    expect(() => getStage("Verifier")).toThrowError(/not registered/);
    registerStageHandlers();
    expect(getStage("Verifier")).toBe(verifierStage);
  });

  it("removes a topology-impossible threat WITHOUT any LLM call", async () => {
    const counter = { n: 0 };
    const ghost = threat({ name: "Ghost", componentId: "nonexistent" });
    const inputs: VerifierInputs = { threats: [ghost], context };
    const result = await verifierStage(
      makeCtx(inputs as unknown as Record<string, unknown>, async () => {
        counter.n++;
        return "[]";
      }),
    );
    expect(counter.n).toBe(0); // no survivors → no refutation call
    expect(result.outputs.topologyRefutedCount).toBe(1);
    expect(result.outputs.verifiedThreats).toHaveLength(0);
  });

  it("keeps a valid threat that the refuter CONFIRMS", async () => {
    const inputs: VerifierInputs = { threats: [threat()], context };
    const result = await verifierStage(
      makeCtx(
        inputs as unknown as Record<string, unknown>,
        verdictStub("CONFIRMED", 0.9),
      ),
    );
    const kept = result.outputs.verifiedThreats as MicroThreat[];
    expect(kept).toHaveLength(1);
    const decisions = result.outputs.decisions as Array<{
      challengeStatus: string;
    }>;
    expect(decisions[0].challengeStatus).toBe("CONFIRMED");
  });

  it("REFUTED @ 0.9 → marked for deletion (not kept)", async () => {
    const inputs: VerifierInputs = { threats: [threat()], context };
    const result = await verifierStage(
      makeCtx(
        inputs as unknown as Record<string, unknown>,
        verdictStub("REFUTED", 0.9),
      ),
    );
    expect(result.outputs.verifiedThreats).toHaveLength(0); // deleted
    expect(result.outputs.decisions).toHaveLength(0);
  });

  it("REFUTED @ 0.5 → kept and flagged UNCERTAIN (below threshold)", async () => {
    const inputs: VerifierInputs = { threats: [threat()], context };
    const result = await verifierStage(
      makeCtx(
        inputs as unknown as Record<string, unknown>,
        verdictStub("REFUTED", 0.5),
      ),
    );
    const kept = result.outputs.verifiedThreats as MicroThreat[];
    expect(kept).toHaveLength(1);
    const decisions = result.outputs.decisions as Array<{
      challengeStatus: string;
    }>;
    expect(decisions[0].challengeStatus).toBe("UNCERTAIN");
  });

  it("records >40%-refuted (component,category) pairs as requeue candidates", async () => {
    const threats = [
      threat({ name: "A", componentId: "api", category: "SPOOFING" }),
      threat({ name: "B", componentId: "api", category: "SPOOFING" }),
      threat({ name: "C", componentId: "api", category: "SPOOFING" }),
    ];
    const inputs: VerifierInputs = { threats, context };
    const result = await verifierStage(
      makeCtx(
        inputs as unknown as Record<string, unknown>,
        verdictStub("REFUTED", 0.9), // all 3 deleted → 100% > 40%
      ),
    );
    expect(result.outputs.requeueCandidates).toEqual([
      { componentId: "api", category: "SPOOFING" },
    ]);
  });
});

describe("Verifier stage — session-scoped deletion (real SQLite)", () => {
  let prisma: PrismaClient;
  let modelId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
    const { setupTestDatabase } = await import("../../../test/setup.js");
    // setupTestDatabase force-resets prisma/test.db and pushes the schema
    // (proves the additive migration on SQLite). Seed + assert through the
    // SAME getPrisma() client the stage uses so there is one connection.
    await setupTestDatabase();
    const { getPrisma } = await import("../../../db.js");
    prisma = await getPrisma();

    const user = await prisma.user.create({
      data: { email: `v-${Date.now()}@test.dev`, name: "V" },
    });
    const org = await prisma.organization.create({
      data: { name: "Org", slug: `org-${Date.now()}` },
    });
    await prisma.membership.create({
      data: { userId: user.id, organizationId: org.id, role: "OWNER" },
    });
    const project = await prisma.project.create({
      data: { name: "P", organizationId: org.id, createdById: user.id },
    });
    const model = await prisma.threatModel.create({
      data: { name: "M", projectId: project.id, createdById: user.id },
    });
    modelId = model.id;

    const norm = normalizeThreatName("Token replay");
    // 1. AI_SUGGESTED, THIS session — the deletion target.
    await prisma.threat.create({
      data: {
        name: "Token replay",
        threatModelId: modelId,
        componentNodeId: "api",
        normalizedName: norm,
        analysisSessionId: "session-1",
        source: "AI_SUGGESTED",
        reviewStatus: "PENDING",
        manuallyEdited: false,
        createdById: user.id,
      },
    });
    // 2. Human-ACCEPTED with the SAME key — must be untouched.
    await prisma.threat.create({
      data: {
        name: "Token replay",
        threatModelId: modelId,
        componentNodeId: "api",
        normalizedName: norm,
        analysisSessionId: "session-1",
        source: "AI_ACCEPTED",
        reviewStatus: "ACCEPTED",
        manuallyEdited: false,
        createdById: user.id,
      },
    });
    // 3. AI_SUGGESTED from a DIFFERENT session — must be untouched.
    await prisma.threat.create({
      data: {
        name: "Token replay",
        threatModelId: modelId,
        componentNodeId: "api",
        normalizedName: norm,
        analysisSessionId: "other-session",
        source: "AI_SUGGESTED",
        reviewStatus: "PENDING",
        manuallyEdited: false,
        createdById: user.id,
      },
    });
  });

  afterAll(async () => {
    const { teardownTestDatabase } = await import("../../../test/setup.js");
    await teardownTestDatabase();
  });

  it("deletes only THIS session's AI_SUGGESTED refuted row; human + other-session rows survive", async () => {
    const ctx: StageContext = {
      executionId: "exec-1",
      threatModelId: modelId,
      organizationId: "org-1",
      sessionId: "session-1",
      inputs: {
        threats: [threat()],
        context,
        persist: { threatModelId: modelId, sessionId: "session-1" },
      },
      aiCall: verdictStub("REFUTED", 0.95),
      progress: async () => undefined,
      checkpoint: async () => undefined,
      signal: new AbortController().signal,
    };

    const result = await verifierStage(ctx);
    expect(result.outputs.deletedCount).toBe(1);

    const rows = await prisma.threat.findMany({
      where: { threatModelId: modelId },
      select: { source: true, reviewStatus: true, analysisSessionId: true },
    });
    // Started with 3; exactly the session-1 AI_SUGGESTED PENDING row deleted.
    expect(rows).toHaveLength(2);
    expect(
      rows.some((r) => r.source === "AI_ACCEPTED"),
      "human-ACCEPTED row must survive",
    ).toBe(true);
    expect(
      rows.some((r) => r.analysisSessionId === "other-session"),
      "other-session AI row must survive",
    ).toBe(true);
    // No surviving row is this session's AI_SUGGESTED PENDING.
    expect(
      rows.some(
        (r) =>
          r.source === "AI_SUGGESTED" && r.analysisSessionId === "session-1",
      ),
    ).toBe(false);
  });

  it("flags a kept UNCERTAIN threat with challengeStatus + note (additive columns exist on SQLite)", async () => {
    const user = await prisma.user.findFirst();
    if (!user) throw new Error("seed user missing");
    const norm = normalizeThreatName("Weak cipher");
    await prisma.threat.create({
      data: {
        name: "Weak cipher",
        threatModelId: modelId,
        componentNodeId: "api",
        normalizedName: norm,
        analysisSessionId: "session-2",
        source: "AI_SUGGESTED",
        reviewStatus: "PENDING",
        manuallyEdited: false,
        createdById: user.id,
      },
    });

    const ctx: StageContext = {
      executionId: "exec-2",
      threatModelId: modelId,
      organizationId: "org-1",
      sessionId: "session-2",
      inputs: {
        threats: [threat({ name: "Weak cipher" })],
        context,
        persist: { threatModelId: modelId, sessionId: "session-2" },
      },
      aiCall: verdictStub("REFUTED", 0.5), // low-conf → kept UNCERTAIN
      progress: async () => undefined,
      checkpoint: async () => undefined,
      signal: new AbortController().signal,
    };
    await verifierStage(ctx);

    const row = await prisma.threat.findFirst({
      where: { threatModelId: modelId, normalizedName: norm },
      select: { challengeStatus: true, verificationNote: true },
    });
    expect(row?.challengeStatus).toBe("UNCERTAIN");
    expect(row?.verificationNote).toBe("stub reason");
  });

  /**
   * Id-space regression.
   *
   * Every fixture above uses "api" as BOTH the DB component id and the canvas
   * nodeId, which is exactly why this survived: the gate keys its refutations
   * on `MicroThreat.componentId` (a DB id), but the rows it must match store
   * `componentNodeId` (a canvas id). When the two strings are equal the
   * mismatch is invisible. These give the component deliberately different ids.
   *
   * Nested inside this describe on purpose — it owns the DB lifecycle, and a
   * sibling describe would run after its afterAll teardown.
   */
  describe("id-space translation", () => {
    const NODE_ID = "node-api-1";
    let dbComponentId: string;
    let userId: string;

    beforeAll(async () => {
      const user = await prisma.user.findFirst();
      if (!user) throw new Error("seed user missing");
      userId = user.id;

      // The whole point: a component whose DB id is NOT its canvas nodeId.
      const component = await prisma.component.create({
        data: {
          threatModelId: modelId,
          nodeId: NODE_ID,
          name: "API Gateway",
          type: "API",
          positionX: 0,
          positionY: 0,
        },
      });
      dbComponentId = component.id;
      expect(dbComponentId).not.toBe(NODE_ID);
    });

    /** Context in DB-id space, as buildThreatModelContext produces it. */
    function p1Context(): ThreatModelContext {
      return {
        name: "TM",
        components: [{ id: dbComponentId, type: "API", name: "API Gateway" }],
        connections: [],
        boundaries: [],
      };
    }

    async function seedThreat(name: string, sessionId: string) {
      await prisma.threat.create({
        data: {
          name,
          threatModelId: modelId,
          // Stored in CANVAS space, as persistAIThreats writes it.
          componentNodeId: NODE_ID,
          normalizedName: normalizeThreatName(name),
          analysisSessionId: sessionId,
          source: "AI_SUGGESTED",
          reviewStatus: "PENDING",
          manuallyEdited: false,
          createdById: userId,
        },
      });
    }

    function p1Ctx(
      name: string,
      sessionId: string,
      aiCall: StageContext["aiCall"],
    ): StageContext {
      return {
        executionId: `exec-${sessionId}`,
        threatModelId: modelId,
        organizationId: "org-1",
        sessionId,
        inputs: {
          // Threat carries the DB component id, as the pipeline emits it.
          threats: [threat({ name, componentId: dbComponentId })],
          context: p1Context(),
          persist: { threatModelId: modelId, sessionId },
        },
        aiCall,
        progress: async () => undefined,
        checkpoint: async () => undefined,
        signal: new AbortController().signal,
      };
    }

    it("deletes a refuted row whose stored nodeId differs from its DB id", async () => {
      await seedThreat("Token replay p1", "p1-session-1");

      const result = await verifierStage(
        p1Ctx("Token replay p1", "p1-session-1", verdictStub("REFUTED", 0.95)),
      );

      expect(result.outputs.deletedCount).toBe(1);
      const survivors = await prisma.threat.findMany({
        where: { threatModelId: modelId, analysisSessionId: "p1-session-1" },
      });
      expect(survivors).toHaveLength(0);
    });

    it("flags a kept row whose stored nodeId differs from its DB id", async () => {
      await seedThreat("Weak cipher p1", "p1-session-2");

      await verifierStage(
        p1Ctx("Weak cipher p1", "p1-session-2", verdictStub("REFUTED", 0.5)),
      );

      const row = await prisma.threat.findFirst({
        where: { threatModelId: modelId, analysisSessionId: "p1-session-2" },
        select: { challengeStatus: true },
      });
      expect(row?.challengeStatus).toBe("UNCERTAIN");
    });

    it("reports a refuted count equal to the rows actually removed", async () => {
      await seedThreat("Count check p1", "p1-session-3");

      const result = await verifierStage(
        p1Ctx("Count check p1", "p1-session-3", verdictStub("REFUTED", 0.95)),
      );

      const remaining = await prisma.threat.count({
        where: { threatModelId: modelId, analysisSessionId: "p1-session-3" },
      });
      expect(remaining).toBe(0);
      expect(result.outputs.deletedCount).toBe(1);
    });
  });
});
