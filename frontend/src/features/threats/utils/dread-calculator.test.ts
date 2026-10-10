import { describe, it, expect } from "vitest";
import {
  calculateDREADScore,
  getDREADSeverityColor,
  getDREADSummary,
  validateDREADMetrics,
  createDefaultDREADMetrics,
} from "./dread-calculator";
import type { DREADMetrics } from "../types/risk-frameworks";

function metrics(overrides: Partial<DREADMetrics> = {}): DREADMetrics {
  return {
    damage: 5,
    reproducibility: 5,
    exploitability: 5,
    affectedUsers: 5,
    discoverability: 5,
    ...overrides,
  };
}

describe("calculateDREADScore", () => {
  it("calculates average as sum / 5", () => {
    const result = calculateDREADScore(
      metrics({
        damage: 10,
        reproducibility: 0,
        exploitability: 0,
        affectedUsers: 0,
        discoverability: 0,
      }),
    );
    expect(result.averageScore).toBe(2);
    expect(result.totalScore).toBe(10);
  });

  it("all-5 metrics → average 5, HIGH severity", () => {
    const result = calculateDREADScore(metrics());
    expect(result.averageScore).toBe(5);
    expect(result.severity).toBe("HIGH");
  });

  it("average < 2.5 → LOW", () => {
    const result = calculateDREADScore(
      metrics({
        damage: 2,
        reproducibility: 2,
        exploitability: 2,
        affectedUsers: 2,
        discoverability: 2,
      }),
    );
    expect(result.severity).toBe("LOW");
  });

  it("average 2.5–4.9 → MEDIUM", () => {
    const result = calculateDREADScore(
      metrics({
        damage: 3,
        reproducibility: 3,
        exploitability: 3,
        affectedUsers: 3,
        discoverability: 3,
      }),
    );
    expect(result.severity).toBe("MEDIUM");
  });

  it("average 7.5+ → CRITICAL", () => {
    const result = calculateDREADScore(
      metrics({
        damage: 8,
        reproducibility: 8,
        exploitability: 8,
        affectedUsers: 8,
        discoverability: 8,
      }),
    );
    expect(result.severity).toBe("CRITICAL");
  });

  it("rounds averageScore to one decimal", () => {
    const result = calculateDREADScore(
      metrics({
        damage: 10,
        reproducibility: 10,
        exploitability: 0,
        affectedUsers: 0,
        discoverability: 0,
      }),
    );
    expect(result.averageScore).toBe(4);
  });
});

describe("getDREADSeverityColor", () => {
  it("returns red for CRITICAL range", () => {
    expect(getDREADSeverityColor(8)).toBe("bg-red-600");
  });
  it("returns orange for HIGH range", () => {
    expect(getDREADSeverityColor(6)).toBe("bg-orange-500");
  });
  it("returns yellow for MEDIUM range", () => {
    expect(getDREADSeverityColor(3)).toBe("bg-yellow-500");
  });
  it("returns blue for LOW range", () => {
    expect(getDREADSeverityColor(1)).toBe("bg-blue-500");
  });
});

describe("getDREADSummary", () => {
  it("lists high-risk factors when >= 7", () => {
    const score = calculateDREADScore(
      metrics({ damage: 9, exploitability: 8 }),
    );
    const summary = getDREADSummary(score);
    expect(summary).toContain("severe damage potential");
    expect(summary).toContain("easy to exploit");
  });

  it("lists mitigating factors when <= 3", () => {
    const score = calculateDREADScore(
      metrics({ damage: 2, reproducibility: 1 }),
    );
    const summary = getDREADSummary(score);
    expect(summary).toContain("limited damage");
    expect(summary).toContain("hard to reproduce");
  });

  it("returns moderate fallback when no extreme factors", () => {
    const score = calculateDREADScore(metrics());
    expect(getDREADSummary(score)).toContain("Moderate risk");
  });
});

describe("validateDREADMetrics", () => {
  it("returns true for valid all-5 metrics", () => {
    expect(validateDREADMetrics(metrics())).toBe(true);
  });
  it("returns true for boundary values 0 and 10", () => {
    expect(
      validateDREADMetrics(metrics({ damage: 0, reproducibility: 10 })),
    ).toBe(true);
  });
  it("returns false when a value exceeds 10", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateDREADMetrics(metrics({ damage: 11 as any }))).toBe(false);
  });
  it("returns false when a value is negative", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateDREADMetrics(metrics({ exploitability: -1 as any }))).toBe(
      false,
    );
  });
});

describe("createDefaultDREADMetrics", () => {
  it("returns all-5 defaults", () => {
    const d = createDefaultDREADMetrics();
    expect(Object.values(d).every((v) => v === 5)).toBe(true);
  });
});
