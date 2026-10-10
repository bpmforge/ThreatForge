/**
 * Residual-severity model unit tests — the shared "realistic mitigation
 * effectiveness" math extracted from data-api.ts and reused by the chain scorer.
 */
import { describe, it, expect } from "vitest";
import {
  residualFraction,
  dropSeverity,
  severityStepsForFraction,
  residualChainSeverity,
  EFFECTIVENESS_CAP,
} from "./residual-severity.js";

describe("residualFraction — diminishing returns, 0.85 cap", () => {
  it("no mitigations leaves the full risk", () => {
    expect(residualFraction([])).toBe(1);
  });

  it("compounds multiplicatively (two 50% controls leave 25%)", () => {
    expect(residualFraction([0.5, 0.5])).toBeCloseTo(0.25, 5);
  });

  it("caps each control at 0.85 — never reaches 0", () => {
    expect(residualFraction([1, 1])).toBeCloseTo(
      (1 - EFFECTIVENESS_CAP) ** 2,
      5,
    );
    expect(residualFraction([0.99])).toBeCloseTo(1 - EFFECTIVENESS_CAP, 5);
  });

  it("matches the data-api risk-register formula for a single control", () => {
    expect(residualFraction([0.85])).toBeCloseTo(0.15, 5);
  });
});

describe("dropSeverity + severityStepsForFraction", () => {
  it("steps a severity down the ladder, clamped at INFO", () => {
    expect(dropSeverity("CRITICAL", 1)).toBe("HIGH");
    expect(dropSeverity("CRITICAL", 2)).toBe("MEDIUM");
    expect(dropSeverity("LOW", 5)).toBe("INFO");
    expect(dropSeverity("HIGH", 0)).toBe("HIGH");
  });

  it("maps residual fraction to rung drops", () => {
    expect(severityStepsForFraction(0.9)).toBe(0); // barely dented
    expect(severityStepsForFraction(0.5)).toBe(1);
    expect(severityStepsForFraction(0.2)).toBe(2);
    expect(severityStepsForFraction(0.05)).toBe(3); // almost broken
  });
});

describe("residualChainSeverity", () => {
  it("equals base severity when no hop is mitigated", () => {
    expect(residualChainSeverity("CRITICAL", [])).toBe("CRITICAL");
  });

  it("drops based on the MOST-mitigated (chokepoint) hop", () => {
    // 0.85-effective control → fraction 0.15 → 2 rungs from CRITICAL → MEDIUM.
    expect(residualChainSeverity("CRITICAL", [0.15, 0.7])).toBe("MEDIUM");
  });

  it("a near-complete break collapses CRITICAL toward INFO", () => {
    expect(residualChainSeverity("CRITICAL", [0.05])).toBe("LOW");
  });
});
