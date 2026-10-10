/**
 * Parity gate: legacy micro loop vs stage-wrapped ThreatIdentifier.
 *
 * Both paths run against the go-forward fixture with the REPLAY AI caller
 * (committed llm-journal.json — zero LLM network, zero cost) and WITHOUT a
 * `persist` arg, so neither path writes to any database: we compare the
 * in-memory result sets before persistence. This is the comparison the
 * existing harness supports naturally (the journal was recorded persist-free
 * and parity-run's golden mode runs the same way), so no per-path test DBs
 * are needed. See src/test/helpers/stage-parity.ts for capture points.
 *
 * Byte-equivalence note: any prompt deviation in the port would throw
 * ReplayMiss (hash lookup) before the comparator even runs — a green run
 * means every LLM exchange was identical, not merely set-equal.
 */
import { describe, it, expect } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadFixtureContext } from "./helpers/fixture-context.js";
import { compareThreatSets, parityKey } from "./helpers/parity.js";
import { createReplayAICaller } from "./helpers/replay-ai.js";
import {
  runLegacyIdentification,
  runStageWrappedIdentification,
} from "./helpers/stage-parity.js";

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "go-forward",
);
const JOURNAL_PATH = join(FIXTURES_DIR, "llm-journal.json");

describe("legacy vs stage-wrapped ThreatIdentifier (replay AI)", () => {
  it("produces an identical identification-phase threat set", async () => {
    const context = loadFixtureContext(FIXTURES_DIR);
    const replayCaller = createReplayAICaller(JOURNAL_PATH, "replay");

    const legacy = await runLegacyIdentification(context, replayCaller);
    const stage = await runStageWrappedIdentification(context, replayCaller);

    const report = compareThreatSets(legacy.loopThreats, stage.loopThreats);
    expect(report.onlyInA).toEqual([]);
    expect(report.onlyInB).toEqual([]);
    expect(report.severityDrift).toEqual([]);
    expect(report.mitigationDrift).toEqual([]);
    expect(report.pass).toBe(true);
    // Sanity: the fixture yields a substantial set (102 at recording time)
    expect(report.intersectionSize).toBeGreaterThan(50);

    // Compound sub-step: legacy's FINAL compounds survive calibration + LLM
    // dedup downstream of the stage boundary, so they must be a subset of
    // the handler's raw compound output (prompt equality is enforced by
    // replay — a divergent compound prompt would have thrown ReplayMiss).
    expect(stage.compoundThreats.length).toBeGreaterThan(0);
    const stageCompoundKeys = new Set(stage.compoundThreats.map(parityKey));
    const missing = legacy.compoundThreats
      .map(parityKey)
      .filter((key) => !stageCompoundKeys.has(key));
    expect(missing).toEqual([]);
  }, 180_000);
});
