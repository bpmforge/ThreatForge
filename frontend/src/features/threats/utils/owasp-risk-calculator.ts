/**
 * OWASP Risk Rating Calculator
 *
 * Implements the OWASP Risk Rating Methodology which considers:
 * - Threat Agent Factors (who would exploit this)
 * - Vulnerability Factors (how easy to exploit)
 * - Technical Impact Factors (what damage occurs)
 * - Business Impact Factors (real-world consequences)
 *
 * @see https://owasp.org/www-community/OWASP_Risk_Rating_Methodology
 */

import type {
  OWASPRiskRatingMetrics,
  OWASPRiskRatingScore,
  OWASPLikelihoodFactor,
} from "../types/risk-frameworks";

/**
 * Calculate the average of an object's numeric values
 */
function calculateAverage(factors: Record<string, number>): number {
  const values = Object.values(factors);
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Determine risk level based on likelihood and impact scores
 */
function determineRiskLevel(
  likelihood: number,
  impact: number,
): "NOTE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  // OWASP Risk Matrix
  // Impact:    HIGH(6-9)    | MEDIUM | CRITICAL | CRITICAL
  //            MEDIUM(3-6)  | LOW    | MEDIUM   | HIGH
  //            LOW(0-3)     | NOTE   | LOW      | MEDIUM
  //                         | LOW    | MEDIUM   | HIGH
  //                         | Likelihood (0-3, 3-6, 6-9)

  if (likelihood < 3) {
    if (impact < 3) return "NOTE";
    if (impact < 6) return "LOW";
    return "MEDIUM";
  }
  if (likelihood < 6) {
    if (impact < 3) return "LOW";
    if (impact < 6) return "MEDIUM";
    return "HIGH";
  }
  // likelihood >= 6
  if (impact < 3) return "MEDIUM";
  if (impact < 6) return "HIGH";
  return "CRITICAL";
}

/**
 * Calculate OWASP Risk Rating score from metrics
 */
export function calculateOWASPRiskRating(
  metrics: OWASPRiskRatingMetrics,
): OWASPRiskRatingScore {
  // Calculate Likelihood score (average of threat agent + vulnerability factors)
  const threatAgentAvg = calculateAverage(
    metrics.threatAgentFactors as unknown as Record<string, number>,
  );
  const vulnerabilityAvg = calculateAverage(
    metrics.vulnerabilityFactors as unknown as Record<string, number>,
  );
  const likelihoodScore = (threatAgentAvg + vulnerabilityAvg) / 2;

  // Calculate Impact scores
  const technicalImpactScore = calculateAverage(
    metrics.technicalImpactFactors as unknown as Record<string, number>,
  );
  const businessImpactScore = calculateAverage(
    metrics.businessImpactFactors as unknown as Record<string, number>,
  );

  // Use the higher of technical or business impact for overall risk
  const overallImpact = Math.max(technicalImpactScore, businessImpactScore);

  // Calculate overall risk score (0-9 scale mapped to 0-10)
  const overallRiskScore =
    Math.round(((likelihoodScore * overallImpact) / 9) * 10) / 10;

  // Determine risk level
  const riskLevel = determineRiskLevel(likelihoodScore, overallImpact);

  return {
    metrics,
    likelihoodScore: Math.round(likelihoodScore * 10) / 10,
    technicalImpactScore: Math.round(technicalImpactScore * 10) / 10,
    businessImpactScore: Math.round(businessImpactScore * 10) / 10,
    overallRiskScore,
    riskLevel,
  };
}

/**
 * Create default OWASP Risk Rating metrics
 */
export function createDefaultOWASPMetrics(): OWASPRiskRatingMetrics {
  const defaultValue = 5 as OWASPLikelihoodFactor;

  return {
    threatAgentFactors: {
      skillLevel: defaultValue,
      motive: defaultValue,
      opportunity: defaultValue,
      size: defaultValue,
    },
    vulnerabilityFactors: {
      easeOfDiscovery: defaultValue,
      easeOfExploit: defaultValue,
      awareness: defaultValue,
      intrusionDetection: defaultValue,
    },
    technicalImpactFactors: {
      lossOfConfidentiality: defaultValue,
      lossOfIntegrity: defaultValue,
      lossOfAvailability: defaultValue,
      lossOfAccountability: defaultValue,
    },
    businessImpactFactors: {
      financialDamage: defaultValue,
      reputationDamage: defaultValue,
      nonCompliance: defaultValue,
      privacyViolation: defaultValue,
    },
  };
}

/**
 * Get risk level color class
 */
export function getOWASPRiskColor(riskLevel: string): string {
  switch (riskLevel) {
    case "NOTE":
      return "bg-gray-400";
    case "LOW":
      return "bg-blue-500";
    case "MEDIUM":
      return "bg-yellow-500";
    case "HIGH":
      return "bg-orange-500";
    case "CRITICAL":
      return "bg-red-600";
    default:
      return "bg-gray-400";
  }
}

/**
 * Generate a summary of the OWASP Risk Rating assessment
 */
export function getOWASPRiskSummary(score: OWASPRiskRatingScore): string {
  const parts: string[] = [];

  // Analyze likelihood factors
  if (score.likelihoodScore >= 6) {
    parts.push("High likelihood of exploitation");
  } else if (score.likelihoodScore >= 3) {
    parts.push("Moderate likelihood");
  } else {
    parts.push("Low likelihood");
  }

  // Compare technical vs business impact
  if (score.technicalImpactScore > score.businessImpactScore + 2) {
    parts.push("primarily technical impact");
  } else if (score.businessImpactScore > score.technicalImpactScore + 2) {
    parts.push("primarily business impact");
  } else {
    parts.push("balanced technical and business impact");
  }

  return parts.join(", ");
}

/**
 * Get detailed breakdown of risk factors
 */
export function getOWASPRiskBreakdown(metrics: OWASPRiskRatingMetrics): {
  highRiskFactors: string[];
  lowRiskFactors: string[];
} {
  const highRiskFactors: string[] = [];
  const lowRiskFactors: string[] = [];

  // Check threat agent factors
  const taFactors = metrics.threatAgentFactors;
  if (taFactors.skillLevel <= 3)
    lowRiskFactors.push("Low attacker skill needed");
  if (taFactors.skillLevel >= 7)
    highRiskFactors.push("High attacker skill available");
  if (taFactors.motive >= 7) highRiskFactors.push("High motivation");
  if (taFactors.opportunity >= 7) highRiskFactors.push("Easy opportunity");
  if (taFactors.size >= 7) highRiskFactors.push("Large threat population");

  // Check vulnerability factors
  const vulnFactors = metrics.vulnerabilityFactors;
  if (vulnFactors.easeOfDiscovery >= 7)
    highRiskFactors.push("Easy to discover");
  if (vulnFactors.easeOfExploit >= 7) highRiskFactors.push("Easy to exploit");
  if (vulnFactors.awareness >= 7) highRiskFactors.push("Publicly known");
  if (vulnFactors.intrusionDetection <= 3)
    lowRiskFactors.push("Good detection");
  if (vulnFactors.intrusionDetection >= 7)
    highRiskFactors.push("Poor detection");

  // Check technical impact factors
  const techFactors = metrics.technicalImpactFactors;
  if (techFactors.lossOfConfidentiality >= 7)
    highRiskFactors.push("Severe data exposure");
  if (techFactors.lossOfIntegrity >= 7)
    highRiskFactors.push("Severe data corruption");
  if (techFactors.lossOfAvailability >= 7)
    highRiskFactors.push("Severe service disruption");
  if (techFactors.lossOfAccountability >= 7)
    highRiskFactors.push("Actions untraceable");

  // Check business impact factors
  const bizFactors = metrics.businessImpactFactors;
  if (bizFactors.financialDamage >= 7)
    highRiskFactors.push("Significant financial risk");
  if (bizFactors.reputationDamage >= 7)
    highRiskFactors.push("Significant reputation risk");
  if (bizFactors.nonCompliance >= 7)
    highRiskFactors.push("Compliance violations");
  if (bizFactors.privacyViolation >= 7)
    highRiskFactors.push("Privacy breach risk");

  return { highRiskFactors, lowRiskFactors };
}
