/**
 * DREAD Risk Calculator
 *
 * DREAD is a threat modeling methodology that rates threats based on:
 * - Damage: How bad would an attack be?
 * - Reproducibility: How easy is it to reproduce the attack?
 * - Exploitability: How much work is it to launch the attack?
 * - Affected Users: How many people will be impacted?
 * - Discoverability: How easy is it to discover the threat?
 *
 * Each factor is rated 0-10, and the final score is the average.
 */

import type { DREADMetrics, DREADScore } from "../types/risk-frameworks";

/**
 * Calculate DREAD score from metrics
 */
export function calculateDREADScore(metrics: DREADMetrics): DREADScore {
  const {
    damage,
    reproducibility,
    exploitability,
    affectedUsers,
    discoverability,
  } = metrics;

  // Calculate total and average
  const totalScore =
    damage + reproducibility + exploitability + affectedUsers + discoverability;
  const averageScore = totalScore / 5;

  // Determine severity based on average score
  let severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  if (averageScore < 2.5) {
    severity = "LOW";
  } else if (averageScore < 5) {
    severity = "MEDIUM";
  } else if (averageScore < 7.5) {
    severity = "HIGH";
  } else {
    severity = "CRITICAL";
  }

  return {
    metrics,
    totalScore,
    averageScore: Math.round(averageScore * 10) / 10,
    severity,
  };
}

/**
 * Get severity color class for DREAD average score
 */
export function getDREADSeverityColor(averageScore: number): string {
  if (averageScore < 2.5) return "bg-blue-500";
  if (averageScore < 5) return "bg-yellow-500";
  if (averageScore < 7.5) return "bg-orange-500";
  return "bg-red-600";
}

/**
 * Generate a summary of the DREAD assessment
 */
export function getDREADSummary(score: DREADScore): string {
  const { metrics, averageScore, severity } = score;
  const parts: string[] = [];

  // Identify high-risk factors (>= 7)
  const highRiskFactors: string[] = [];
  if (metrics.damage >= 7) highRiskFactors.push("severe damage potential");
  if (metrics.reproducibility >= 7) highRiskFactors.push("easily reproducible");
  if (metrics.exploitability >= 7) highRiskFactors.push("easy to exploit");
  if (metrics.affectedUsers >= 7) highRiskFactors.push("affects many users");
  if (metrics.discoverability >= 7) highRiskFactors.push("easily discoverable");

  if (highRiskFactors.length > 0) {
    parts.push(`Key concerns: ${highRiskFactors.join(", ")}`);
  }

  // Identify mitigating factors (<= 3)
  const lowRiskFactors: string[] = [];
  if (metrics.damage <= 3) lowRiskFactors.push("limited damage");
  if (metrics.reproducibility <= 3) lowRiskFactors.push("hard to reproduce");
  if (metrics.exploitability <= 3) lowRiskFactors.push("difficult to exploit");
  if (metrics.affectedUsers <= 3) lowRiskFactors.push("few users affected");
  if (metrics.discoverability <= 3) lowRiskFactors.push("hard to discover");

  if (lowRiskFactors.length > 0 && severity !== "CRITICAL") {
    parts.push(`Mitigating: ${lowRiskFactors.join(", ")}`);
  }

  if (parts.length === 0) {
    return `Moderate risk across all factors (avg: ${averageScore})`;
  }

  return parts.join(". ");
}

/**
 * Create default DREAD metrics
 */
export function createDefaultDREADMetrics(): DREADMetrics {
  return {
    damage: 5,
    reproducibility: 5,
    exploitability: 5,
    affectedUsers: 5,
    discoverability: 5,
  };
}

/**
 * Validate DREAD metrics
 */
export function validateDREADMetrics(metrics: DREADMetrics): boolean {
  const values = Object.values(metrics);
  return values.every((v) => typeof v === "number" && v >= 0 && v <= 10);
}
