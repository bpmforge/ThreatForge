/**
 * Parity CLI — Track A golden-run gate (A0-2).
 *
 * Runs the legacy micro-analysis pipeline on the go-forward fixture with the
 * REPLAY AI caller (committed llm-journal.json — zero network, zero cost),
 * normalizes the resulting threat set, and compares it against the committed
 * golden snapshot (golden-threats.json) with compareThreatSets.
 *
 * Usage from server/ directory:
 *   npm run parity:run                 # compare against golden, exit 1 on fail
 *   npm run parity:run -- --update-golden   # rewrite the golden snapshot
 *   npm run parity:run -- --stage-wrapped   # A1-2: legacy vs ThreatIdentifier
 *                                           # stage handler (both replay-only)
 *
 * If the golden snapshot does not exist yet, the first run writes it and
 * exits 0 (commit the file).
 *
 * // A1-4 wires the full unified pipeline here: run it with the same replay
 * // caller and compare legacy vs unified end-to-end.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runMicroAnalysis } from "../src/services/ai/micro-analysis/pipeline.js";
import type { MicroThreat } from "../src/services/ai/micro-analysis/types.js";
import { createReplayAICaller } from "../src/test/helpers/replay-ai.js";
import { loadFixtureContext } from "../src/test/helpers/fixture-context.js";
import {
  compareThreatSets,
  formatParityReport,
  parityKey,
  type ThreatLike,
} from "../src/test/helpers/parity.js";

const FIXTURES_DIR = join(
  import.meta.dirname,
  "..",
  "src",
  "test",
  "fixtures",
  "go-forward",
);
const JOURNAL_PATH = join(FIXTURES_DIR, "llm-journal.json");
const GOLDEN_PATH = join(FIXTURES_DIR, "golden-threats.json");

/** Normalized snapshot entry — ThreatLike plus its precomputed key. */
interface GoldenEntry extends ThreatLike {
  key: string;
}

function toGoldenEntries(threats: MicroThreat[]): GoldenEntry[] {
  return threats
    .map((t) => ({
      key: parityKey(t),
      name: t.name,
      category: t.category,
      severity: t.severity,
      componentId: t.componentId,
      mitigationCount: t.mitigations?.length ?? 0,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * A1-2 mode: legacy loop (captured at the stage boundary via onCheckpoint)
 * vs ThreatIdentifier stage handler, both replay-only and persist-free (see
 * src/test/helpers/stage-parity.ts for the comparison-design rationale).
 */
async function runStageWrappedComparison(): Promise<void> {
  const { runLegacyIdentification, runStageWrappedIdentification } =
    await import("../src/test/helpers/stage-parity.js");
  const context = loadFixtureContext(FIXTURES_DIR);
  const replayCaller = createReplayAICaller(JOURNAL_PATH, "replay");

  console.log("Running LEGACY identification (replay, no network)...");
  const legacy = await runLegacyIdentification(context, replayCaller);
  console.log(
    `  legacy: ${legacy.loopThreats.length} loop threats, ` +
      `${legacy.compoundThreats.length} compound (post-calibration)`,
  );
  console.log("Running STAGE-WRAPPED ThreatIdentifier (replay, no network)...");
  const stage = await runStageWrappedIdentification(context, replayCaller);
  console.log(
    `  stage:  ${stage.loopThreats.length} loop threats, ` +
      `${stage.compoundThreats.length} compound (raw)`,
  );

  const report = compareThreatSets(legacy.loopThreats, stage.loopThreats);
  console.log(
    "\nParity report — A = legacy loop, B = ThreatIdentifier stage\n",
  );
  console.log(formatParityReport(report));

  // Compound sub-step: legacy final compounds survive calibration + LLM
  // dedup, so they must be a SUBSET of the handler's raw compound output.
  const stageCompoundKeys = new Set(stage.compoundThreats.map(parityKey));
  const missingCompound = legacy.compoundThreats
    .map(parityKey)
    .filter((k) => !stageCompoundKeys.has(k));
  for (const key of missingCompound) {
    console.error(`  COMPOUND MISSING FROM STAGE OUTPUT: ${key}`);
  }

  if (!report.pass || missingCompound.length > 0) {
    console.error("\nParity FAILED: legacy vs stage-wrapped.");
    process.exit(1);
  }
  console.log("\nParity PASSED: legacy vs stage-wrapped.");
}

async function main(): Promise<void> {
  if (process.argv.includes("--stage-wrapped")) {
    await runStageWrappedComparison();
    return;
  }
  const updateGolden = process.argv.includes("--update-golden");

  const context = loadFixtureContext(FIXTURES_DIR);
  const replayCaller = createReplayAICaller(JOURNAL_PATH, "replay");

  console.log("Running legacy micro pipeline in replay mode (no network)...");
  const started = Date.now();
  const result = await runMicroAnalysis(context, replayCaller, {
    methodologies: ["stride"],
  });
  console.log(
    `Replay run complete in ${((Date.now() - started) / 1000).toFixed(1)}s — ` +
      `${result.summary.totalThreats} threats, ${result.summary.llmCalls} LLM calls, ` +
      `${result.summary.parseFailures} parse failures`,
  );

  const current = toGoldenEntries([
    ...result.threats,
    ...result.compoundThreats,
  ]);

  if (updateGolden || !existsSync(GOLDEN_PATH)) {
    writeFileSync(GOLDEN_PATH, JSON.stringify(current, null, 2) + "\n", "utf8");
    console.log(
      `${updateGolden ? "Updated" : "Created"} golden snapshot: ` +
        `${GOLDEN_PATH} (${current.length} threats). Commit this file.`,
    );
    return;
  }

  const golden = JSON.parse(readFileSync(GOLDEN_PATH, "utf8")) as GoldenEntry[];

  const report = compareThreatSets(golden, current);
  console.log("\nParity report — A = golden snapshot, B = this replay run\n");
  console.log(formatParityReport(report));

  if (!report.pass) {
    console.error("\nParity FAILED against the golden snapshot.");
    process.exit(1);
  }
  console.log("\nParity PASSED.");
}

main().catch((err) => {
  console.error("Parity run failed:", err);
  process.exit(1);
});
