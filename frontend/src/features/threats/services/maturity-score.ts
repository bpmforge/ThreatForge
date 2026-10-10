/**
 * Threat Model Maturity Score
 *
 * Calculates a single score (0-100) for "how good is this threat model?"
 * Based on: component coverage, threat coverage, mitigation rate,
 * compliance mapping, review status, and freshness.
 */

export interface MaturityInput {
  componentCount: number;
  connectionCount: number;
  boundaryCount: number;
  threatCount: number;
  mitigatedThreatCount: number;
  componentsWithThreats: number;
  complianceFrameworksMapped: number;
  hasBeenReviewed: boolean;
  daysSinceUpdate: number;
  hasDataClassification: boolean;
}

export interface MaturityScore {
  overall: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  breakdown: {
    architecture: number; // Components + connections + boundaries
    threatCoverage: number; // % of components with threats
    mitigationRate: number; // % of threats mitigated
    compliance: number; // Compliance frameworks mapped
    review: number; // Has been reviewed
    freshness: number; // How recently updated
    context: number; // Data classification filled
  };
  suggestions: string[];
}

const WEIGHTS = {
  architecture: 15,
  threatCoverage: 25,
  mitigationRate: 25,
  compliance: 10,
  review: 10,
  freshness: 10,
  context: 5,
};

export function calculateMaturityScore(input: MaturityInput): MaturityScore {
  const breakdown = {
    architecture: scoreArchitecture(input),
    threatCoverage: scoreThreatCoverage(input),
    mitigationRate: scoreMitigationRate(input),
    compliance: scoreCompliance(input),
    review: input.hasBeenReviewed ? 100 : 0,
    freshness: scoreFreshness(input.daysSinceUpdate),
    context: input.hasDataClassification ? 100 : 0,
  };

  const overall = Math.round(
    (breakdown.architecture * WEIGHTS.architecture +
      breakdown.threatCoverage * WEIGHTS.threatCoverage +
      breakdown.mitigationRate * WEIGHTS.mitigationRate +
      breakdown.compliance * WEIGHTS.compliance +
      breakdown.review * WEIGHTS.review +
      breakdown.freshness * WEIGHTS.freshness +
      breakdown.context * WEIGHTS.context) /
      100,
  );

  const grade =
    overall >= 90
      ? "A"
      : overall >= 75
        ? "B"
        : overall >= 60
          ? "C"
          : overall >= 40
            ? "D"
            : "F";

  const suggestions = generateSuggestions(input, breakdown);

  return { overall, grade, breakdown, suggestions };
}

function scoreArchitecture(input: MaturityInput): number {
  // Need at least: 3 components, 2 connections, 1 boundary
  let score = 0;
  if (input.componentCount >= 3) score += 40;
  else if (input.componentCount >= 1) score += 20;
  if (input.connectionCount >= 2) score += 30;
  else if (input.connectionCount >= 1) score += 15;
  if (input.boundaryCount >= 1) score += 30;
  return Math.min(score, 100);
}

function scoreThreatCoverage(input: MaturityInput): number {
  if (input.componentCount === 0) return 0;
  const coverage = input.componentsWithThreats / input.componentCount;
  return Math.round(coverage * 100);
}

function scoreMitigationRate(input: MaturityInput): number {
  if (input.threatCount === 0) return 0;
  return Math.round((input.mitigatedThreatCount / input.threatCount) * 100);
}

function scoreCompliance(input: MaturityInput): number {
  if (input.complianceFrameworksMapped >= 3) return 100;
  if (input.complianceFrameworksMapped >= 2) return 75;
  if (input.complianceFrameworksMapped >= 1) return 50;
  return 0;
}

function scoreFreshness(daysSinceUpdate: number): number {
  if (daysSinceUpdate <= 7) return 100;
  if (daysSinceUpdate <= 30) return 80;
  if (daysSinceUpdate <= 60) return 50;
  if (daysSinceUpdate <= 90) return 25;
  return 0;
}

function generateSuggestions(
  input: MaturityInput,
  breakdown: MaturityScore["breakdown"],
): string[] {
  const suggestions: string[] = [];

  if (breakdown.architecture < 50) {
    suggestions.push(
      "Add trust boundaries to define security zones in your architecture",
    );
  }
  if (breakdown.threatCoverage < 50) {
    const uncovered = input.componentCount - input.componentsWithThreats;
    suggestions.push(
      `${uncovered} components have no threats — use AI to suggest threats for each`,
    );
  }
  if (breakdown.mitigationRate < 50 && input.threatCount > 0) {
    const unmitigated = input.threatCount - input.mitigatedThreatCount;
    suggestions.push(
      `${unmitigated} threats are unmitigated — prioritize CRITICAL and HIGH severity`,
    );
  }
  if (breakdown.compliance === 0) {
    suggestions.push(
      "Map threats to a compliance framework (SOC2, HIPAA, etc.) for audit readiness",
    );
  }
  if (!input.hasBeenReviewed) {
    suggestions.push("Request a peer review to validate your threat analysis");
  }
  if (breakdown.freshness < 50) {
    suggestions.push(
      "This model is getting stale — review and update for recent architecture changes",
    );
  }
  if (!input.hasDataClassification) {
    suggestions.push(
      "Add data classification to components for more accurate threat analysis",
    );
  }

  return suggestions;
}
