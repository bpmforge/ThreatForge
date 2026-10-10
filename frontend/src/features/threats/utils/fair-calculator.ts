/**
 * FAIR (Factor Analysis of Information Risk) calculator.
 *
 * Formula:
 *   LEF  = TEF × Vulnerability
 *   SLE  = PrimaryLoss + (SLEF × SecondaryLoss)
 *   ALE  = LEF × SLE
 */
import type { FAIRFactors, FAIRScore } from "../types/risk-frameworks";

function aleToRiskLevel(ale: number): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  if (ale >= 1_000_000) return "CRITICAL";
  if (ale >= 100_000) return "HIGH";
  if (ale >= 10_000) return "MEDIUM";
  return "LOW";
}

export function calculateFAIR(factors: FAIRFactors): FAIRScore {
  const {
    threatEventFrequency,
    vulnerability,
    primaryLoss,
    secondaryLossEventFrequency,
    secondaryLoss,
  } = factors;

  const lef = threatEventFrequency * Math.min(1, Math.max(0, vulnerability));
  const sle = primaryLoss + secondaryLossEventFrequency * secondaryLoss;
  const ale = lef * sle;

  return {
    factors,
    lossEventFrequency: Math.round(lef * 100) / 100,
    singleLossExpectancy: Math.round(sle),
    annualizedLossExpectancy: Math.round(ale),
    riskLevel: aleToRiskLevel(ale),
  };
}

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}
