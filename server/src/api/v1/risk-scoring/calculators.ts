/**
 * Risk Score Calculators
 */
import type { OWASPFactors, DREADFactors } from "./schemas.js";

export interface OWASPScoreResult {
  score: number;
  rating: string;
  likelihood: number;
  impact: number;
}

export interface DREADScoreResult {
  score: number;
  rating: string;
}

/**
 * Calculate OWASP Risk Rating score
 */
export function calculateOWASPScore(factors: OWASPFactors): OWASPScoreResult {
  // Likelihood = average of threat agent + vulnerability factors
  const threatAgentFactors =
    (factors.skillLevel + factors.motive + factors.opportunity + factors.size) /
    4;
  const vulnerabilityFactors =
    (factors.easeOfDiscovery +
      factors.easeOfExploit +
      factors.awareness +
      factors.intrusionDetection) /
    4;
  const likelihood = (threatAgentFactors + vulnerabilityFactors) / 2;

  // Impact = average of technical + business impact factors
  const technicalImpact =
    (factors.lossOfConfidentiality +
      factors.lossOfIntegrity +
      factors.lossOfAvailability +
      factors.lossOfAccountability) /
    4;
  const businessImpact =
    (factors.financialDamage +
      factors.reputationDamage +
      factors.nonCompliance +
      factors.privacyViolation) /
    4;
  const impact = (technicalImpact + businessImpact) / 2;

  // Overall risk score (0-9 scale, normalized to 0-10)
  const score = ((likelihood * impact) / 9) * 10;

  // Rating based on likelihood and impact matrix
  let rating: string;
  if (likelihood < 3 && impact < 3) rating = "Info";
  else if (likelihood < 3 && impact < 6) rating = "Low";
  else if (likelihood < 3 && impact >= 6) rating = "Medium";
  else if (likelihood < 6 && impact < 3) rating = "Low";
  else if (likelihood < 6 && impact < 6) rating = "Medium";
  else if (likelihood < 6 && impact >= 6) rating = "High";
  else if (likelihood >= 6 && impact < 3) rating = "Medium";
  else if (likelihood >= 6 && impact < 6) rating = "High";
  else rating = "Critical";

  return { score: Math.round(score * 10) / 10, rating, likelihood, impact };
}

/**
 * Calculate DREAD score
 */
export function calculateDREADScore(factors: DREADFactors): DREADScoreResult {
  const score =
    (factors.damage +
      factors.reproducibility +
      factors.exploitability +
      factors.affectedUsers +
      factors.discoverability) /
    5;

  let rating: string;
  if (score <= 2) rating = "Info";
  else if (score <= 4) rating = "Low";
  else if (score <= 6) rating = "Medium";
  else if (score <= 8) rating = "High";
  else rating = "Critical";

  return { score: Math.round(score * 10) / 10, rating };
}

/**
 * Calculate custom framework score
 */
export function calculateCustomScore(
  factors: Record<string, number>,
): DREADScoreResult {
  const values = Object.values(factors);
  const score = values.reduce((a, b) => a + b, 0) / values.length;

  let rating: string;
  if (score <= 2) rating = "Info";
  else if (score <= 4) rating = "Low";
  else if (score <= 6) rating = "Medium";
  else if (score <= 8) rating = "High";
  else rating = "Critical";

  return { score: Math.round(score * 10) / 10, rating };
}
