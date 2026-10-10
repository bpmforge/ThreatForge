/**
 * Duplicate-detector calibration against the labelled fixtures.
 *
 * READ THE CAVEATS before quoting these numbers:
 * - golden-seed-08 labels are AI-made (Claude subagents, unreviewed by a
 *   human; SEED08_SECOND_OPINION.md disputes 5 of 51 sampled rows). The older
 *   threat-labels.json was labelled against a snapshot whose threats no longer
 *   exist in the golden, so it only contributes name pairs.
 * - Labels carry name / category / component only. This measures the NAME +
 *   TARGET + CATEGORY part of the detector; description, CWE and mitigation
 *   features are not exercised here.
 * - Every labelled duplicate pair is same-component, so there is no positive
 *   evidence for cross-component merging — which is why the detector never
 *   auto-merges across targets.
 *
 * The thresholds were chosen for MERGE-band precision (a false merge hides a
 * real finding); the assertions below pin that choice: zero false merges on
 * either label set, and the review band must still surface some duplicates.
 */
import { describe, it, expect } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  calibrate,
  calibratePersistContext,
} from "../../../test/helpers/dedup-calibration.js";
import { loadFixtureContext } from "../../../test/helpers/fixture-context.js";

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../test/fixtures/go-forward",
);
const SEED08 = join(FIXTURES, "labels/golden-seed-08-mtplx27b.labels.json");
const LEGACY = join(FIXTURES, "threat-labels.json");
const NAMES = new Map(
  loadFixtureContext(FIXTURES).components.map((c) => [c.id, c.name]),
);

describe("duplicate detector calibration (labelled fixtures)", () => {
  it("seed 08: no false merges; merge + review surfaces some labelled duplicates", () => {
    const r = calibrate(SEED08, NAMES);
    expect(r.positivePairs).toBeGreaterThan(25);
    expect(r.falseMerges).toEqual([]);
    expect(r.merge.precision).toBe(1);
    expect(r.merge.truePositive).toBeGreaterThanOrEqual(1);
    expect(r.mergeOrReview.recall).toBeGreaterThanOrEqual(0.1);
  });

  it("persist-time scoring (one threat vs its component's rows, small-set IDF) makes no false links or loser confirmations", () => {
    // persistAIThreats (findMergeMatch) and markDedupLosers score a threat
    // against only the same-target rows, so IDF is computed over a handful of
    // threats — flatter than the whole-model IDF the thresholds were set on.
    for (const file of [SEED08, LEGACY]) {
      const r = calibratePersistContext(file);
      expect(r.falseLinks, `${file} false links`).toEqual([]);
      expect(r.falseLoserConfirmations, `${file} false loser marks`).toEqual(
        [],
      );
    }
  });

  it("threat-labels.json: no false merges", () => {
    const r = calibrate(LEGACY, NAMES);
    expect(r.falseMerges).toEqual([]);
    expect(r.merge.precision).toBe(1);
  });
});
