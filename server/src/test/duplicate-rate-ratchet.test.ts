/**
 * Duplicate-rate ratchet over the recorded fixtures (no LLM, no DB).
 * Ceilings live in fixtures/go-forward/duplicate-rate-ceiling.json — see its
 * README. Fails when the post-guard duplicate rate rises above a ceiling, and
 * when a ceiling is left slack above an improvement (so it can only go down).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GO_FORWARD_DIR,
  measureReplay,
  measureSeeds,
} from "./helpers/dedup-eval.js";

const SLACK = 0.005;
const ceilings = JSON.parse(
  readFileSync(join(GO_FORWARD_DIR, "duplicate-rate-ceiling.json"), "utf8"),
) as { replay: number; seedsMean: number };

function ratchet(label: string, measured: number, ceiling: number) {
  expect(
    measured,
    `${label}: duplicate rate ${measured} rose above its ceiling ${ceiling}`,
  ).toBeLessThanOrEqual(ceiling);
  expect(
    ceiling - measured,
    `${label}: duplicate rate improved to ${measured}; lower the ceiling (${ceiling}) in duplicate-rate-ceiling.json`,
  ).toBeLessThanOrEqual(SLACK);
}

describe("duplicate-rate ratchet (recorded fixtures)", () => {
  it("replayed journal stays at or below its ceiling", async () => {
    const m = await measureReplay();
    expect(m.threatsIn).toBeGreaterThan(100);
    expect(m.duplicateRateAfter).toBeLessThanOrEqual(m.duplicateRateBefore);
    ratchet("replay", m.duplicateRateAfter, ceilings.replay);
  }, 120_000);

  it("recorded seeds (names only) stay at or below their ceiling", async () => {
    const seeds = await measureSeeds();
    expect(seeds.length).toBeGreaterThan(20);
    const mean =
      Math.round(
        (seeds.reduce((s, x) => s + x.after, 0) / seeds.length) * 10000,
      ) / 10000;
    ratchet("seeds", mean, ceilings.seedsMean);
  });
});
