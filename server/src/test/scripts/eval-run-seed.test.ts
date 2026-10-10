/**
 * Seed selection for scripts/eval-run.ts `--seed=<name>`.
 *
 * Only `resolveSeed` is exercised — the pure part of the script (no fs).
 */
import { describe, it, expect } from "vitest";
import { resolveSeed } from "../../../scripts/eval-run.js";

const seeds = [
  { name: "golden-seed-01.json" },
  { name: "golden-seed-08-mtplx27b.json" },
  { name: "golden-seed-09-mtplx27b.json" },
];

describe("resolveSeed", () => {
  it("matches the full file name", () => {
    expect(resolveSeed("golden-seed-01.json", seeds)).toBe(seeds[0]);
  });

  it("matches the file name without .json", () => {
    expect(resolveSeed("golden-seed-08-mtplx27b", seeds)).toBe(seeds[1]);
  });

  it("matches an unambiguous substring", () => {
    expect(resolveSeed("seed-08", seeds)).toBe(seeds[1]);
  });

  it("throws on an ambiguous substring rather than guessing", () => {
    expect(() => resolveSeed("mtplx27b", seeds)).toThrow(/ambiguous/);
  });

  it("throws when nothing matches, listing what exists", () => {
    expect(() => resolveSeed("seed-99", seeds)).toThrow(
      /no seed matches.*golden-seed-01/,
    );
  });
});
