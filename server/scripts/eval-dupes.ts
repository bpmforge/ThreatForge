/**
 * eval-dupes — duplicate rate of the recorded fixtures under the mechanical
 * duplicate guard, plus the detector's calibration against labelled pairs.
 * No LLM, no DB. See src/test/helpers/dedup-eval.ts for what each number is.
 *
 * Usage:
 *   npm run eval:dupes            # table
 *   npm run eval:dupes -- --json  # machine-readable
 */
import { join } from "node:path";
import {
  GO_FORWARD_DIR,
  measureReplay,
  measureSeeds,
} from "../src/test/helpers/dedup-eval.js";
import { calibrate } from "../src/test/helpers/dedup-calibration.js";
import { loadFixtureContext } from "../src/test/helpers/fixture-context.js";

process.env.LOG_LEVEL ??= "silent";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

async function main() {
  const replay = await measureReplay();
  const seeds = await measureSeeds();
  const names = new Map(
    loadFixtureContext(GO_FORWARD_DIR).components.map((c) => [c.id, c.name]),
  );
  const calibration = [
    join(GO_FORWARD_DIR, "labels/golden-seed-08-mtplx27b.labels.json"),
    join(GO_FORWARD_DIR, "threat-labels.json"),
  ].map((f) => {
    const r = calibrate(f, names);
    return {
      file: r.file,
      positivePairs: r.positivePairs,
      merge: r.merge,
      mergeOrReview: r.mergeOrReview,
    };
  });

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ replay, seeds, calibration }, null, 2));
    return;
  }

  console.log("Replay (llm-journal.json, full features, detector-only guard)");
  console.log(
    `  threats ${replay.threatsIn}  merged ${replay.merged}  review pairs ${replay.reviewPairs}  ` +
      `duplicate rate ${pct(replay.duplicateRateBefore)} -> ${pct(replay.duplicateRateAfter)}  ` +
      `shared controls ${replay.mitigationGroups}  restated mitigations dropped ${replay.droppedDuplicateMitigations}`,
  );
  console.log("\nSeeds (names/category/component only)");
  console.log(
    "  seed                         n   before  after  merged  review",
  );
  for (const s of seeds) {
    console.log(
      `  ${s.seed.padEnd(26)} ${String(s.threats).padStart(4)}  ${pct(s.before).padStart(6)} ${pct(s.after).padStart(6)}  ${String(s.merged).padStart(6)}  ${String(s.reviewPairs).padStart(6)}`,
    );
  }
  console.log("\nCalibration (AI-made labels; names only)");
  for (const c of calibration) {
    console.log(
      `  ${c.file}: ${c.positivePairs} labelled duplicate pairs | merge band precision ${pct(c.merge.precision)} recall ${pct(c.merge.recall)} | merge+review precision ${pct(c.mergeOrReview.precision)} recall ${pct(c.mergeOrReview.recall)}`,
    );
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
