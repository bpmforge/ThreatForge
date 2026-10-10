/**
 * Full threat-analysis-v2 pipeline end-to-end + parity vs legacy.
 *
 * End-to-end: the seeded pipeline executes on the go-forward fixture via the REAL
 * pipeline-service.executePipeline (real SQLite test DB — PipelineExecution
 * and PipelineStageExecution rows are written) with the replay AI caller
 * supplied through StageHandlerRuntime. The AIService stub throws on use,
 * proving every executed stage is handler-backed. The Verifier is a required
 * stage; its adversarial-refutation prompts are not
 * in the committed parity journal (which captures the legacy call set only),
 * so a thin stub answers verifier-system-prompt calls with all-CONFIRMED —
 * the parity comparison is taken at the SeverityCalibrator boundary (before
 * the Verifier), so this neither perturbs parity nor extends the journal.
 *
 * Parity: the legacy comparison point includes mitigations and
 * calibrated severities — the FINAL sets (legacy runMicroAnalysis result vs
 * the SeverityCalibrator stage output after finalizeV2Run's floor +
 * mitigation pass, applied through the same exported helper) are compared
 * with the parity comparator. Both paths run persist-free against the
 * committed journal; any prompt deviation anywhere in the chain throws ReplayMiss before the
 * comparator runs. StrideClassifier runs validate-only, so it makes no LLM call and cannot perturb the comparison.
 *
 * JOURNAL SCOPE: the committed journal was recorded from a full legacy run
 * (identification + mitigation + compound + calibration + dedup prompts),
 * which is exactly the call set both paths replay — no journal extension
 * was needed. The mitigations-only preseed path needs DB rows and recorded
 * preseed prompts the journal does not cover; it is unit-tested with stubs
 * (mitigation-synthesizer.test.ts) and exercised in the persist-inclusive
 * parity test.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import type { StageName } from "../services/ai/stages/registry.js";
import type { AIService } from "../services/ai/ai-service.js";
import type { MicroThreat } from "../services/ai/micro-analysis/types.js";
import { loadFixtureContext } from "./helpers/fixture-context.js";
import { compareThreatSets } from "./helpers/parity.js";
import { createReplayAICaller } from "./helpers/replay-ai.js";
import { runLegacyFull } from "./helpers/stage-parity.js";
import { VERIFIER_SYSTEM_PROMPT } from "../services/ai/prompts/verifier.js";
import { floorAndMitigateV2Final } from "../jobs/suggest-threats-v2-finalize.js";
import { wrapWithThreatStyle } from "../services/ai/stages/identifier-context.js";
import type { AICallFn } from "../services/ai/micro-analysis/types.js";

/**
 * Wrap the replay caller so Verifier refutation calls (not in the parity
 * journal) resolve deterministically to all-CONFIRMED. Echoes each prompt's
 * `threatRef:` line back so the gate keeps every threat.
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

describe("full threat-analysis-v2 pipeline (end-to-end + parity)", () => {
  let prisma: PrismaClient;
  let pipelineId: string;
  let stageIds: Record<StageName, string>;
  let userId: string;
  let organizationId: string;
  let threatModelId: string;

  beforeAll(async () => {
    // Point the app's getPrisma() at the isolated test DB BEFORE anything
    // initializes the client (db.ts caches on first call).
    process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
    const { setupTestDatabase, testData } = await import("./setup.js");
    prisma = await setupTestDatabase();

    const user = await testData.createUser();
    const org = await testData.createOrganization();
    await testData.createMembership(user.id, org.id);
    const project = await testData.createProject(org.id, user.id);
    const model = await testData.createThreatModel(project.id, user.id);
    userId = user.id;
    organizationId = org.id;
    threatModelId = model.id;

    const { seedThreatAnalysisV2Pipeline } = await import(
      "../../scripts/seed-pipelines.js"
    );
    ({ pipelineId, stageIds } = await seedThreatAnalysisV2Pipeline(prisma));
  });

  afterAll(async () => {
    const { teardownTestDatabase } = await import("./setup.js");
    await teardownTestDatabase();
  });

  it("executes end-to-end via pipeline-service with replay AI and matches the legacy FINAL set", async () => {
    // Re-register in case an earlier test file reset the shared registry.
    const { registerStageHandlers } = await import(
      "../services/ai/stages/index.js"
    );
    registerStageHandlers();
    const { executePipeline, clearPipelineCache } = await import(
      "../services/ai/pipeline-service.js"
    );
    clearPipelineCache();

    const context = loadFixtureContext(FIXTURES_DIR);
    const replayCaller = withVerifierStub(
      createReplayAICaller(JOURNAL_PATH, "replay"),
    );
    const aiServiceStub = {
      complete: async () => {
        throw new Error(
          "AIService must not be called — every v2 stage is handler-backed",
        );
      },
    } as unknown as AIService;

    const result = await executePipeline(
      {
        pipelineId,
        userId,
        organizationId,
        threatModelId,
        inputMetadata: { context, options: { methodologies: ["stride"] } },
      },
      aiServiceStub,
      { aiCall: replayCaller, sessionId: "a1-3-parity-session" },
    );

    // --- End-to-end assertions ---
    expect(result.status).toBe("COMPLETED");
    expect(result.error).toBeUndefined();
    const statusByName = Object.fromEntries(
      result.stageResults.map((s) => [s.stageName, s.status]),
    );
    for (const name of [
      "ArchitectureReader",
      "ThreatIdentifier",
      "EvidenceEnricher",
      "StrideClassifier", // methodology === STRIDE → runs (validate-only)
      "MitigationSynthesizer",
      "ComplianceMapper",
      "SeverityCalibrator",
      "Verifier", // required challenger gate, runs with the stub
    ]) {
      expect(statusByName[name], `${name} status`).toBe("COMPLETED");
    }

    // PipelineExecution / PipelineStageExecution rows written
    const execution = await prisma.pipelineExecution.findUnique({
      where: { id: result.executionId },
      include: { stageExecutions: true },
    });
    expect(execution?.status).toBe("COMPLETED");
    expect(execution?.stageExecutions).toHaveLength(8);
    const completedRows = execution!.stageExecutions.filter(
      (s) => s.status === "COMPLETED",
    );
    expect(completedRows).toHaveLength(8); // all 8 stages run, including the Verifier
    for (const row of completedRows) {
      expect(
        row.outputParsed,
        `stage ${row.stageId} outputParsed`,
      ).toBeTruthy();
    }

    // --- Parity vs legacy (FINAL sets: mitigations + calibrated severities) ---
    const v2Calibrated = (
      result.outputs[stageIds.SeverityCalibrator] as {
        calibratedThreats: MicroThreat[];
      }
    ).calibratedThreats;
    expect(v2Calibrated.length).toBeGreaterThan(50);
    // v2 mitigates once, after the confidence floor, in finalizeV2Run —
    // apply that exact step (same helper, same style wrap) before comparing.
    const { kept: v2Final } = await floorAndMitigateV2Final({
      threats: [...v2Calibrated],
      context,
      mitigationAiCall: await wrapWithThreatStyle(
        replayCaller,
        undefined,
        "mitigations",
      ),
      parseFailures: [],
      report: () => {},
    });

    const legacyFinal = await runLegacyFull(context, replayCaller);

    const report = compareThreatSets(legacyFinal, v2Final);
    expect(report.onlyInA).toEqual([]);
    expect(report.onlyInB).toEqual([]);
    expect(report.severityDrift).toEqual([]);
    expect(report.mitigationDrift).toEqual([]);
    expect(report.pass).toBe(true);
    expect(report.intersectionSize).toBe(legacyFinal.length);
  }, 300_000);
});
