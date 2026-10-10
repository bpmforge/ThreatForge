/**
 * Stage retry ceilings.
 *
 * Both values came from a DB column with no ceiling. The backoff was
 * `2^attempt` seconds uncapped, so a stage row with retryCount 20 would wait
 * ~145 hours on its final attempt alone. Pure functions on purpose: the cap is
 * asserted without any test actually sleeping.
 */
import { describe, it, expect } from "vitest";
import {
  backoffMs,
  clampRetries,
  MAX_BACKOFF_MS,
  MAX_STAGE_RETRIES,
} from "../pipeline-service.js";

describe("clampRetries", () => {
  it("keeps the seeded default of 0", () => {
    expect(clampRetries(0)).toBe(0);
  });

  it("passes through a sane value", () => {
    expect(clampRetries(3)).toBe(3);
  });

  it("caps a value that would otherwise run for hours", () => {
    expect(clampRetries(20)).toBe(MAX_STAGE_RETRIES);
  });

  it("treats null/undefined as no retries", () => {
    expect(clampRetries(null)).toBe(0);
    expect(clampRetries(undefined)).toBe(0);
  });

  it("refuses a negative or non-finite column value", () => {
    expect(clampRetries(-5)).toBe(0);
    expect(clampRetries(NaN)).toBe(0);
  });
});

describe("backoffMs", () => {
  it("is exponential while under the cap", () => {
    expect(backoffMs(0)).toBe(1_000);
    expect(backoffMs(1)).toBe(2_000);
    expect(backoffMs(2)).toBe(4_000);
  });

  it("caps instead of growing without bound", () => {
    expect(backoffMs(10)).toBe(MAX_BACKOFF_MS);
    // The shape that motivated the finding: 2^20 s is ~12 days.
    expect(backoffMs(20)).toBe(MAX_BACKOFF_MS);
  });

  it("bounds the total wait across a fully-clamped retry run", () => {
    const total = Array.from({ length: MAX_STAGE_RETRIES }, (_, i) =>
      backoffMs(i),
    ).reduce((a, b) => a + b, 0);
    // Well inside the ai-heavy lock (35 min) rather than multiples of it.
    expect(total).toBeLessThan(120_000);
  });
});
