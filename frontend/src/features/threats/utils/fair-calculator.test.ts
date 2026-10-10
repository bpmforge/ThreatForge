import { describe, it, expect } from "vitest";
import { calculateFAIR, formatCurrency } from "./fair-calculator";
import type { FAIRFactors } from "../types/risk-frameworks";

function factors(overrides: Partial<FAIRFactors> = {}): FAIRFactors {
  return {
    threatEventFrequency: 10,
    vulnerability: 0.5,
    primaryLoss: 50_000,
    secondaryLossEventFrequency: 0.3,
    secondaryLoss: 20_000,
    ...overrides,
  };
}

describe("calculateFAIR", () => {
  it("calculates LEF = TEF × vulnerability", () => {
    const result = calculateFAIR(
      factors({ threatEventFrequency: 20, vulnerability: 0.25 }),
    );
    expect(result.lossEventFrequency).toBe(5);
  });

  it("calculates SLE = primaryLoss + SLEF × secondaryLoss", () => {
    const result = calculateFAIR(
      factors({
        primaryLoss: 100_000,
        secondaryLossEventFrequency: 2,
        secondaryLoss: 50_000,
      }),
    );
    expect(result.singleLossExpectancy).toBe(200_000);
  });

  it("calculates ALE = LEF × SLE", () => {
    // TEF=10, vuln=0.5 → LEF=5; primary=50k, SLEF=0.3, secondary=20k → SLE=56k; ALE=280k
    const result = calculateFAIR(factors());
    expect(result.annualizedLossExpectancy).toBe(280_000);
  });

  it("clamps vulnerability to [0, 1]", () => {
    const over = calculateFAIR(factors({ vulnerability: 1.5 }));
    const normal = calculateFAIR(factors({ vulnerability: 1.0 }));
    expect(over.lossEventFrequency).toBe(normal.lossEventFrequency);

    const under = calculateFAIR(factors({ vulnerability: -0.5 }));
    expect(under.lossEventFrequency).toBe(0);
  });

  it("returns CRITICAL when ALE >= 1,000,000", () => {
    const result = calculateFAIR(
      factors({
        threatEventFrequency: 100,
        vulnerability: 1,
        primaryLoss: 50_000,
        secondaryLossEventFrequency: 0,
        secondaryLoss: 0,
      }),
    );
    expect(result.riskLevel).toBe("CRITICAL");
  });

  it("returns HIGH when ALE is 100k–999k", () => {
    const result = calculateFAIR(
      factors({
        threatEventFrequency: 10,
        vulnerability: 1,
        primaryLoss: 50_000,
        secondaryLossEventFrequency: 0,
        secondaryLoss: 0,
      }),
    );
    expect(result.riskLevel).toBe("HIGH");
  });

  it("returns MEDIUM when ALE is 10k–99k", () => {
    const result = calculateFAIR(
      factors({
        threatEventFrequency: 1,
        vulnerability: 1,
        primaryLoss: 50_000,
        secondaryLossEventFrequency: 0,
        secondaryLoss: 0,
      }),
    );
    expect(result.riskLevel).toBe("MEDIUM");
  });

  it("returns LOW when ALE < 10k", () => {
    const result = calculateFAIR(
      factors({
        threatEventFrequency: 0.1,
        vulnerability: 0.1,
        primaryLoss: 1_000,
        secondaryLossEventFrequency: 0,
        secondaryLoss: 0,
      }),
    );
    expect(result.riskLevel).toBe("LOW");
  });

  it("returns zero ALE when vulnerability is 0", () => {
    const result = calculateFAIR(factors({ vulnerability: 0 }));
    expect(result.annualizedLossExpectancy).toBe(0);
    expect(result.riskLevel).toBe("LOW");
  });

  it("round-trips factors through the result", () => {
    const f = factors();
    const result = calculateFAIR(f);
    expect(result.factors).toBe(f);
  });
});

describe("formatCurrency", () => {
  it("formats values >= 1M as $XM", () => {
    expect(formatCurrency(1_500_000)).toBe("$1.5M");
    expect(formatCurrency(1_000_000)).toBe("$1.0M");
  });

  it("formats values >= 1k as $XK", () => {
    expect(formatCurrency(75_000)).toBe("$75K");
    expect(formatCurrency(1_000)).toBe("$1K");
  });

  it("formats values < 1k as raw dollars", () => {
    expect(formatCurrency(500)).toBe("$500");
    expect(formatCurrency(0)).toBe("$0");
  });
});
