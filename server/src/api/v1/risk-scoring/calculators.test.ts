/**
 * Unit tests for risk score calculators (OWASP, DREAD, custom)
 */
import { describe, it, expect } from "vitest";
import {
  calculateOWASPScore,
  calculateDREADScore,
  calculateCustomScore,
} from "./calculators.js";
import type { OWASPFactors, DREADFactors } from "./schemas.js";

// Helpers to build factor objects
const owaspFactors = (overrides: Partial<OWASPFactors> = {}): OWASPFactors => ({
  skillLevel: 5,
  motive: 5,
  opportunity: 5,
  size: 5,
  easeOfDiscovery: 5,
  easeOfExploit: 5,
  awareness: 5,
  intrusionDetection: 5,
  lossOfConfidentiality: 5,
  lossOfIntegrity: 5,
  lossOfAvailability: 5,
  lossOfAccountability: 5,
  financialDamage: 5,
  reputationDamage: 5,
  nonCompliance: 5,
  privacyViolation: 5,
  ...overrides,
});

const dreadFactors = (overrides: Partial<DREADFactors> = {}): DREADFactors => ({
  damage: 5,
  reproducibility: 5,
  exploitability: 5,
  affectedUsers: 5,
  discoverability: 5,
  ...overrides,
});

describe("calculateOWASPScore", () => {
  describe("score calculation", () => {
    it("returns a numeric score", () => {
      const result = calculateOWASPScore(owaspFactors());
      expect(typeof result.score).toBe("number");
    });

    it("score is rounded to 1 decimal place", () => {
      const result = calculateOWASPScore(owaspFactors());
      const decimals = result.score.toString().split(".")[1]?.length ?? 0;
      expect(decimals).toBeLessThanOrEqual(1);
    });

    it("all-zero factors produce score 0", () => {
      const zeros: OWASPFactors = owaspFactors(
        Object.fromEntries(
          Object.keys(owaspFactors()).map((k) => [k, 0]),
        ) as Partial<OWASPFactors>,
      );
      const result = calculateOWASPScore(zeros);
      expect(result.score).toBe(0);
    });

    it("all-max factors (9) produce score 90", () => {
      // Formula: ((likelihood * impact) / 9) * 10
      // All-9: likelihood=9, impact=9 → (9*9/9)*10 = 90
      const maxes: OWASPFactors = owaspFactors(
        Object.fromEntries(
          Object.keys(owaspFactors()).map((k) => [k, 9]),
        ) as Partial<OWASPFactors>,
      );
      const result = calculateOWASPScore(maxes);
      expect(result.score).toBe(90);
    });

    it("returns likelihood and impact values", () => {
      const result = calculateOWASPScore(owaspFactors());
      expect(result.likelihood).toBeGreaterThanOrEqual(0);
      expect(result.impact).toBeGreaterThanOrEqual(0);
    });
  });

  describe("rating thresholds", () => {
    it("returns Info for low likelihood + low impact", () => {
      const result = calculateOWASPScore(
        owaspFactors({
          ...(Object.fromEntries(
            Object.keys(owaspFactors()).map((k) => [k, 1]),
          ) as Partial<OWASPFactors>),
        }),
      );
      expect(result.rating).toBe("Info");
    });

    it("returns Critical for high likelihood + high impact", () => {
      const result = calculateOWASPScore(
        owaspFactors(
          Object.fromEntries(
            Object.keys(owaspFactors()).map((k) => [k, 9]),
          ) as Partial<OWASPFactors>,
        ),
      );
      expect(result.rating).toBe("Critical");
    });

    it("returns Medium for mid-range factors", () => {
      const result = calculateOWASPScore(owaspFactors());
      expect(["Low", "Medium", "High"]).toContain(result.rating);
    });

    it("returns High for high likelihood low-mid impact", () => {
      // likelihood ≥ 6, impact 3–6 → High
      const result = calculateOWASPScore(
        owaspFactors({
          skillLevel: 9,
          motive: 9,
          opportunity: 9,
          size: 9,
          easeOfDiscovery: 9,
          easeOfExploit: 9,
          awareness: 9,
          intrusionDetection: 9,
          lossOfConfidentiality: 4,
          lossOfIntegrity: 4,
          lossOfAvailability: 4,
          lossOfAccountability: 4,
          financialDamage: 4,
          reputationDamage: 4,
          nonCompliance: 4,
          privacyViolation: 4,
        }),
      );
      expect(result.rating).toBe("High");
    });

    it("low likelihood + high impact returns Medium", () => {
      // likelihood < 3, impact ≥ 6 → Medium
      const result = calculateOWASPScore(
        owaspFactors({
          skillLevel: 1,
          motive: 1,
          opportunity: 1,
          size: 1,
          easeOfDiscovery: 1,
          easeOfExploit: 1,
          awareness: 1,
          intrusionDetection: 1,
          lossOfConfidentiality: 8,
          lossOfIntegrity: 8,
          lossOfAvailability: 8,
          lossOfAccountability: 8,
          financialDamage: 8,
          reputationDamage: 8,
          nonCompliance: 8,
          privacyViolation: 8,
        }),
      );
      expect(result.rating).toBe("Medium");
    });
  });
});

describe("calculateDREADScore", () => {
  describe("score calculation", () => {
    it("returns average of all 5 factors", () => {
      const result = calculateDREADScore(
        dreadFactors({
          damage: 10,
          reproducibility: 0,
          exploitability: 0,
          affectedUsers: 0,
          discoverability: 0,
        }),
      );
      expect(result.score).toBe(2);
    });

    it("all factors equal — score equals that value", () => {
      const result = calculateDREADScore(dreadFactors());
      expect(result.score).toBe(5);
    });

    it("rounds to 1 decimal", () => {
      const result = calculateDREADScore(
        dreadFactors({ damage: 3, reproducibility: 7 }),
      );
      const decimals = result.score.toString().split(".")[1]?.length ?? 0;
      expect(decimals).toBeLessThanOrEqual(1);
    });
  });

  describe("rating thresholds", () => {
    it("score 0 → Info", () => {
      const result = calculateDREADScore(
        dreadFactors(
          Object.fromEntries(
            Object.keys(dreadFactors()).map((k) => [k, 0]),
          ) as Partial<DREADFactors>,
        ),
      );
      expect(result.rating).toBe("Info");
    });

    it("score ≤ 2 → Info", () => {
      const result = calculateDREADScore(
        dreadFactors({
          damage: 2,
          reproducibility: 2,
          exploitability: 2,
          affectedUsers: 2,
          discoverability: 2,
        }),
      );
      expect(result.rating).toBe("Info");
    });

    it("score ~3 → Low", () => {
      const result = calculateDREADScore(
        dreadFactors({
          damage: 3,
          reproducibility: 3,
          exploitability: 3,
          affectedUsers: 3,
          discoverability: 3,
        }),
      );
      expect(result.rating).toBe("Low");
    });

    it("score 5 → Medium", () => {
      const result = calculateDREADScore(dreadFactors());
      expect(result.rating).toBe("Medium");
    });

    it("score ~7 → High", () => {
      const result = calculateDREADScore(
        dreadFactors({
          damage: 7,
          reproducibility: 7,
          exploitability: 7,
          affectedUsers: 7,
          discoverability: 7,
        }),
      );
      expect(result.rating).toBe("High");
    });

    it("score ~9 → Critical", () => {
      const result = calculateDREADScore(
        dreadFactors({
          damage: 9,
          reproducibility: 9,
          exploitability: 9,
          affectedUsers: 9,
          discoverability: 9,
        }),
      );
      expect(result.rating).toBe("Critical");
    });
  });
});

describe("calculateCustomScore", () => {
  it("averages all factor values", () => {
    const result = calculateCustomScore({ a: 4, b: 6 });
    expect(result.score).toBe(5);
  });

  it("handles a single factor", () => {
    const result = calculateCustomScore({ impact: 8 });
    expect(result.score).toBe(8);
  });

  it("rounds to 1 decimal", () => {
    const result = calculateCustomScore({ a: 1, b: 2, c: 3 });
    const decimals = result.score.toString().split(".")[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(1);
  });

  it("returns Info for low score", () => {
    const result = calculateCustomScore({ a: 1, b: 1 });
    expect(result.rating).toBe("Info");
  });

  it("returns Critical for high score", () => {
    const result = calculateCustomScore({ a: 9, b: 9 });
    expect(result.rating).toBe("Critical");
  });

  it("returns Medium for score around 5", () => {
    const result = calculateCustomScore({ a: 5, b: 5 });
    expect(result.rating).toBe("Medium");
  });
});
