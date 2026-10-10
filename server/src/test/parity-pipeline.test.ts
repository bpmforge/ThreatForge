/**
 * Persist-inclusive parity: legacy vs unified worker path in CI.
 *
 * Both paths run on the go-forward fixture with the committed replay journal
 * (zero network — any prompt deviation anywhere throws ReplayMiss) against
 * the real SQLite test DB, each persisting into its OWN threat model:
 * - legacy: runMicroAnalysis with a persist arg (streaming persist + final
 *   persist + loser cleanup, sessionId-tagged) — exactly what the
 *   flag-off worker drives.
 * - v2: runSuggestThreatsV2 (the function the flag-on worker calls) — the
 *   seeded threat-analysis-v2 pipeline via pipeline-service with the same
 *   persist plumbing routed through stage inputs + the finalize port.
 *
 * Compared: (1) in-memory final result sets and the full result/summary
 * shape (the AiJob.result contract — the worker's shared COMPLETED block is
 * the same code for both paths, so wrapper equality holds by construction);
 * (2) PERSISTED Threat + Mitigation rows via the parity comparator on the
 * ADR-006 key; (3) the job contract on the v2 AiJob row (progress
 * 100, legacy "done" message, legacy-shaped checkpoint JSON).
 *
 * TEST-DB SHAPE (documented): the fixture models are created WITHOUT
 * Component rows, so nodeId resolution falls back to the fixture component
 * ids on BOTH paths (persistAIThreats's documented fallback) and the two
 * models' persisted targetKeys are directly comparable. The org is
 * aiRoutingPolicy=local-only so EPSS enrichment is OFF on both paths
 * (network-free), matching the persist-free journal recording. verifyClient
 * is omitted on both paths (citation verification is identical shared code).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import type {
  MicroAnalysisResult,
  MicroThreat,
} from "../services/ai/micro-analysis/types.js";
import { loadFixtureContext } from "./helpers/fixture-context.js";
import { compareThreatSets, type ThreatLike } from "./helpers/parity.js";
import { createReplayAICaller } from "./helpers/replay-ai.js";
import { VERIFIER_SYSTEM_PROMPT } from "../services/ai/prompts/verifier.js";
import type { AICallFn } from "../services/ai/micro-analysis/types.js";

/**
 * Wrap the v2 caller so the Verifier (which runs WITH persist on the v2
 * path) resolves its refutation calls to all-CONFIRMED — keeping every threat,
 * so the persisted v2 set stays identical to the Verifier-free legacy path.
 * The refutation prompt is not in the parity journal by design; this neither
 * deletes rows nor extends the journal. Verifier persist parity is covered
 * directly in stages/verifier.test.ts.
 */
function withVerifierStub(inner: AICallFn): AICallFn {
  return async (system, user) => {
    if (system !== VERIFIER_SYSTEM_PROMPT) return inner(system, user);
    const refs = [...user.matchAll(/threatRef:\s*(.+)/g)].map((m) =>
      m[1].trim(),
    );
    return JSON.stringify(
      refs.map((threatRef) => ({
        threatRef,
        verdict: "CONFIRMED",
        confidence: 0.9,
      })),
    );
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures", "go-forward");
const JOURNAL_PATH = join(FIXTURES_DIR, "llm-journal.json");
const TEST_DB_PATH = resolve(__dirname, "../../prisma/test.db");

/** Map persisted rows to the comparator's ThreatLike shape. */
function rowsToThreatLikes(
  rows: Array<{
    name: string;
    strideCategories: string;
    severity: string;
    componentNodeId: string | null;
    connectionEdgeId: string | null;
    mitigations: unknown[];
  }>,
): ThreatLike[] {
  return rows.map((r) => ({
    name: r.name,
    category: (JSON.parse(r.strideCategories || "[]") as string[])[0] ?? "",
    severity: r.severity as ThreatLike["severity"],
    componentId: r.componentNodeId,
    connectionEdgeId: r.connectionEdgeId,
    mitigationCount: r.mitigations.length,
  }));
}

async function waitForJobProgress(
  prisma: PrismaClient,
  jobId: string,
  pct: number,
): Promise<{ progress: number; progressMessage: string | null }> {
  // Progress writes are fire-and-forget in the worker (legacy contract);
  // give the final "done" update a moment to land.
  for (let i = 0; i < 40; i++) {
    const row = await prisma.aiJob.findUniqueOrThrow({
      where: { id: jobId },
      select: { progress: true, progressMessage: true },
    });
    if (row.progress >= pct) return row;
    await new Promise((r) => setTimeout(r, 50));
  }
  return prisma.aiJob.findUniqueOrThrow({
    where: { id: jobId },
    select: { progress: true, progressMessage: true },
  });
}

describe("persist-inclusive parity: legacy vs unified worker path", () => {
  let prisma: PrismaClient;
  let userId: string;
  let organizationId: string;
  let legacyModelId: string;
  let v2ModelId: string;
  let v2JobId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
    const { setupTestDatabase, testData } = await import("./setup.js");
    prisma = await setupTestDatabase();

    const user = await testData.createUser();
    const org = await testData.createOrganization();
    await testData.createMembership(user.id, org.id);
    // local-only → EPSS/OSV enrichment disabled on BOTH paths (network-free,
    // matches the journal recording).
    await prisma.organization.update({
      where: { id: org.id },
      data: { aiRoutingPolicy: "local-only" },
    });
    const project = await testData.createProject(org.id, user.id);
    const modelL = await testData.createThreatModel(project.id, user.id, {
      name: "Parity Legacy",
    });
    const modelV = await testData.createThreatModel(project.id, user.id, {
      name: "Parity V2",
    });
    userId = user.id;
    organizationId = org.id;
    legacyModelId = modelL.id;
    v2ModelId = modelV.id;

    const { seedThreatAnalysisV2Pipeline } = await import(
      "../../scripts/seed-pipelines.js"
    );
    await seedThreatAnalysisV2Pipeline(prisma);

    const job = await prisma.aiJob.create({
      data: {
        userId,
        organizationId,
        type: "SUGGEST_THREATS",
        threatModelId: v2ModelId,
        input: JSON.stringify({ mode: "micro", methodologies: ["stride"] }),
      },
    });
    v2JobId = job.id;
  }, 120_000);

  afterAll(async () => {
    const { teardownTestDatabase } = await import("./setup.js");
    await teardownTestDatabase();
  });

  it("persists an identical review queue through both paths (replay AI)", async () => {
    const context = loadFixtureContext(FIXTURES_DIR);
    const replayCaller = createReplayAICaller(JOURNAL_PATH, "replay");

    // --- Legacy path (what the flag-off worker drives) ---
    const { runMicroAnalysis } = await import(
      "../services/ai/micro-analysis/pipeline.js"
    );
    const legacyResult = await runMicroAnalysis(
      context,
      replayCaller,
      { methodologies: ["stride"] },
      {
        threatModelId: legacyModelId,
        userId,
        sessionId: "parity-legacy-session",
      },
    );

    // --- Unified path (the exact function the flag-on worker calls) ---
    const { runSuggestThreatsV2 } = await import(
      "../jobs/suggest-threats-v2.js"
    );
    const v2Result = (await runSuggestThreatsV2({
      prisma,
      data: {
        type: "SUGGEST_THREATS",
        userId,
        organizationId,
        threatModelId: v2ModelId,
        input: "{}",
        dbJobId: v2JobId,
      },
      input: { methodologies: ["stride"], minConfidence: 0.7 },
      context,
      aiCall: withVerifierStub(replayCaller),
    })) as MicroAnalysisResult;

    // --- (1) In-memory final sets + result shape (AiJob.result contract) ---
    const legacyFinal: MicroThreat[] = [
      ...legacyResult.threats,
      ...legacyResult.compoundThreats,
    ];
    const v2Final: MicroThreat[] = [
      ...v2Result.threats,
      ...v2Result.compoundThreats,
    ];
    expect(legacyFinal.length).toBeGreaterThan(50);
    expect(v2Final).toHaveLength(legacyFinal.length);

    const memoryReport = compareThreatSets(legacyFinal, v2Final);
    expect(memoryReport.onlyInA).toEqual([]);
    expect(memoryReport.onlyInB).toEqual([]);
    expect(memoryReport.severityDrift).toEqual([]);
    expect(memoryReport.mitigationDrift).toEqual([]);
    expect(memoryReport.pass).toBe(true);

    // Result shape is the same builder contract: identical keys, identical
    // summary modulo wall-clock duration. The COMPLETED wrapper around it
    // (enrichment + progress=100) is shared worker code for both paths, so
    // no frontend poller test is needed — the payload cannot diverge.
    // `summary.verification` is a v2-only additive field (the challenger-
    // gate Verifier is a unified-path stage the legacy builder never runs), so
    // it is stripped from the parity comparison alongside wall-clock duration.
    expect(Object.keys(v2Result).sort()).toEqual(
      Object.keys(legacyResult).sort(),
    );
    // `summary.roleInferences` is the mirror image: a legacy-path additive
    // field. The unified path RUNS role inference and surfaces every inference
    // on the progress stream and in the structured log (stages/threat-identifier
    // does both, as does jobs/ai-flow for the fan-out path), so no flag is lost
    // operationally — but its summary is assembled from stage outputs further
    // downstream and does not carry the convenience field. Stripped from the
    // comparison for the same reason `verification` is, and worth closing if
    // the summary ever becomes the only place a consumer looks.
    const { verification: _v2Verification, ...v2SummaryRest } =
      v2Result.summary;
    const { roleInferences: _legacyRoleInferences, ...legacySummaryRest } =
      legacyResult.summary as typeof legacyResult.summary & {
        roleInferences?: unknown;
      };
    expect({ ...v2SummaryRest, duration: 0 }).toEqual({
      ...legacySummaryRest,
      duration: 0,
    });

    // --- (2) Persisted rows — ADR-006 key parity across the two models ---
    const [rowsL, rowsV] = await Promise.all([
      prisma.threat.findMany({
        where: { threatModelId: legacyModelId },
        include: { mitigations: true },
      }),
      prisma.threat.findMany({
        where: { threatModelId: v2ModelId },
        include: { mitigations: true },
      }),
    ]);
    expect(rowsV).toHaveLength(rowsL.length);

    const persistedReport = compareThreatSets(
      rowsToThreatLikes(rowsL),
      rowsToThreatLikes(rowsV),
    );
    expect(persistedReport.onlyInA).toEqual([]);
    expect(persistedReport.onlyInB).toEqual([]);
    expect(persistedReport.severityDrift).toEqual([]);
    expect(persistedReport.mitigationDrift).toEqual([]);
    expect(persistedReport.pass).toBe(true);
    expect(persistedReport.intersectionSize).toBe(rowsL.length);

    // Both paths wrote through the same ADR-006 persist: AI_SUGGESTED,
    // PENDING (human review pending), session-tagged for cleanup.
    for (const row of rowsV) {
      expect(row.source).toBe("AI_SUGGESTED");
      expect(row.reviewStatus).toBe("PENDING");
      expect(row.analysisSessionId).toBe(v2JobId);
      expect(row.normalizedName).toBeTruthy();
    }
    expect(rowsV.some((r) => r.mitigations.length > 0)).toBe(true);

    // --- (3) Frozen job contract on the v2 AiJob row ---
    const jobRow = await waitForJobProgress(prisma, v2JobId, 100);
    expect(jobRow.progress).toBe(100);
    expect(jobRow.progressMessage).toBe(
      `${legacyResult.summary.totalThreats} threats, ` +
        `${legacyResult.summary.componentsCovered}/${context.components.length} components covered`,
    );
    const checkpointRaw = (
      await prisma.aiJob.findUniqueOrThrow({
        where: { id: v2JobId },
        select: { checkpoint: true },
      })
    ).checkpoint;
    const checkpoint = JSON.parse(checkpointRaw!) as {
      completedComponentIds: string[];
      threats: MicroThreat[];
    };
    expect(checkpoint.completedComponentIds).toHaveLength(
      context.components.length,
    );
    expect(checkpoint.threats.length).toBeGreaterThan(0);
  }, 600_000);
});
