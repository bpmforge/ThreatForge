/**
 * Reporting Service - Recommendation Generation
 */
import type { RiskDistribution } from "./types.js";

/** Generate recommendations based on analysis. */
export function generateRecommendations(
  threats: Array<{ severity: string; status: string }>,
  mitigations: Array<{ status: string }>,
  riskDistribution: RiskDistribution,
  complianceScores: Array<{ framework: string; score: number; gaps: number }>,
): string[] {
  const recommendations: string[] = [];

  // Critical/high risk recommendations
  if (riskDistribution.critical > 0) {
    recommendations.push(
      `Address ${riskDistribution.critical} critical-severity threat(s) immediately.`,
    );
  }

  if (riskDistribution.high > 3) {
    recommendations.push(
      `Prioritize mitigation of ${riskDistribution.high} high-severity threats.`,
    );
  }

  // Open threats recommendation
  const openThreats = threats.filter(
    (t) => t.status === "OPEN" || t.status === "IN_PROGRESS",
  ).length;
  const openRatio = threats.length > 0 ? openThreats / threats.length : 0;

  if (openRatio > 0.5) {
    recommendations.push(
      `${Math.round(openRatio * 100)}% of threats are still open. Consider allocating more resources to threat mitigation.`,
    );
  }

  // Mitigation completion recommendation
  const completedMitigations = mitigations.filter(
    (m) => m.status === "IMPLEMENTED",
  ).length;
  const mitigationRatio =
    mitigations.length > 0 ? completedMitigations / mitigations.length : 1;

  if (mitigationRatio < 0.5 && mitigations.length > 0) {
    recommendations.push(
      `Only ${Math.round(mitigationRatio * 100)}% of mitigations are complete. Review and expedite planned mitigations.`,
    );
  }

  // Compliance recommendations
  for (const score of complianceScores) {
    if (score.score < 50) {
      recommendations.push(
        `${score.framework} compliance score is ${score.score}%. Consider a focused remediation effort.`,
      );
    }
    if (score.gaps > 0) {
      recommendations.push(
        `Address ${score.gaps} high-priority ${score.framework} compliance gaps.`,
      );
    }
  }

  // Default recommendation if all is well
  if (recommendations.length === 0) {
    recommendations.push(
      "Continue regular threat model reviews and security testing.",
    );
    recommendations.push(
      "Consider expanding threat modeling to new features and integrations.",
    );
  }

  return recommendations.slice(0, 5);
}
