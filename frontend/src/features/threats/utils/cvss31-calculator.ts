/**
 * CVSS 3.1 Calculator
 *
 * Implements the Common Vulnerability Scoring System version 3.1
 * Based on the official CVSS 3.1 Specification Document.
 *
 * @see https://www.first.org/cvss/v3.1/specification-document
 */

import type {
  CVSS31BaseMetrics,
  CVSS31Score,
  CVSS31AttackVector,
  CVSS31AttackComplexity,
  CVSS31PrivilegesRequired,
  CVSS31UserInteraction,
  CVSS31Scope,
  CVSS31Impact,
} from "../types/risk-frameworks";

// Metric value weights from CVSS 3.1 specification
const ATTACK_VECTOR_WEIGHTS: Record<CVSS31AttackVector, number> = {
  NETWORK: 0.85,
  ADJACENT: 0.62,
  LOCAL: 0.55,
  PHYSICAL: 0.2,
};

const ATTACK_COMPLEXITY_WEIGHTS: Record<CVSS31AttackComplexity, number> = {
  LOW: 0.77,
  HIGH: 0.44,
};

const PRIVILEGES_REQUIRED_WEIGHTS: Record<
  CVSS31PrivilegesRequired,
  { unchanged: number; changed: number }
> = {
  NONE: { unchanged: 0.85, changed: 0.85 },
  LOW: { unchanged: 0.62, changed: 0.68 },
  HIGH: { unchanged: 0.27, changed: 0.5 },
};

const USER_INTERACTION_WEIGHTS: Record<CVSS31UserInteraction, number> = {
  NONE: 0.85,
  REQUIRED: 0.62,
};

const IMPACT_WEIGHTS: Record<CVSS31Impact, number> = {
  NONE: 0,
  LOW: 0.22,
  HIGH: 0.56,
};

// Vector string abbreviations
const VECTOR_ABBREV = {
  attackVector: { NETWORK: "N", ADJACENT: "A", LOCAL: "L", PHYSICAL: "P" },
  attackComplexity: { LOW: "L", HIGH: "H" },
  privilegesRequired: { NONE: "N", LOW: "L", HIGH: "H" },
  userInteraction: { NONE: "N", REQUIRED: "R" },
  scope: { UNCHANGED: "U", CHANGED: "C" },
  impact: { NONE: "N", LOW: "L", HIGH: "H" },
} as const;

/**
 * Calculate the Impact Sub Score (ISS)
 */
function calculateISS(c: number, i: number, a: number): number {
  return 1 - (1 - c) * (1 - i) * (1 - a);
}

/**
 * Calculate the Impact score based on scope
 */
function calculateImpact(iss: number, scope: CVSS31Scope): number {
  if (scope === "UNCHANGED") {
    return 6.42 * iss;
  } else {
    return 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15);
  }
}

/**
 * Calculate the Exploitability score
 */
function calculateExploitability(
  av: number,
  ac: number,
  pr: number,
  ui: number,
): number {
  return 8.22 * av * ac * pr * ui;
}

/**
 * Round up to one decimal place (CVSS 3.1 rounding)
 */
function roundUp(value: number): number {
  return Math.ceil(value * 10) / 10;
}

/**
 * Get severity rating from score
 */
function getSeverity(
  score: number,
): "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score === 0) return "NONE";
  if (score < 4.0) return "LOW";
  if (score < 7.0) return "MEDIUM";
  if (score < 9.0) return "HIGH";
  return "CRITICAL";
}

/**
 * Generate the CVSS 3.1 vector string
 */
export function generateCVSS31VectorString(metrics: CVSS31BaseMetrics): string {
  const parts = [
    "CVSS:3.1",
    `AV:${VECTOR_ABBREV.attackVector[metrics.attackVector]}`,
    `AC:${VECTOR_ABBREV.attackComplexity[metrics.attackComplexity]}`,
    `PR:${VECTOR_ABBREV.privilegesRequired[metrics.privilegesRequired]}`,
    `UI:${VECTOR_ABBREV.userInteraction[metrics.userInteraction]}`,
    `S:${VECTOR_ABBREV.scope[metrics.scope]}`,
    `C:${VECTOR_ABBREV.impact[metrics.confidentialityImpact]}`,
    `I:${VECTOR_ABBREV.impact[metrics.integrityImpact]}`,
    `A:${VECTOR_ABBREV.impact[metrics.availabilityImpact]}`,
  ];
  return parts.join("/");
}

/**
 * Parse a CVSS 3.1 vector string into base metrics
 */
export function parseCVSS31VectorString(
  vectorString: string,
): CVSS31BaseMetrics | null {
  const reverseAbbrev = {
    AV: { N: "NETWORK", A: "ADJACENT", L: "LOCAL", P: "PHYSICAL" },
    AC: { L: "LOW", H: "HIGH" },
    PR: { N: "NONE", L: "LOW", H: "HIGH" },
    UI: { N: "NONE", R: "REQUIRED" },
    S: { U: "UNCHANGED", C: "CHANGED" },
    C: { N: "NONE", L: "LOW", H: "HIGH" },
    I: { N: "NONE", L: "LOW", H: "HIGH" },
    A: { N: "NONE", L: "LOW", H: "HIGH" },
  } as const;

  try {
    const parts = vectorString.split("/");
    if (!parts[0]?.startsWith("CVSS:3.1")) return null;

    const metrics: Partial<CVSS31BaseMetrics> = {};

    for (let i = 1; i < parts.length; i++) {
      const [key, value] = parts[i].split(":");
      if (!key || !value) continue;

      switch (key) {
        case "AV":
          metrics.attackVector = reverseAbbrev.AV[
            value as keyof typeof reverseAbbrev.AV
          ] as CVSS31AttackVector;
          break;
        case "AC":
          metrics.attackComplexity = reverseAbbrev.AC[
            value as keyof typeof reverseAbbrev.AC
          ] as CVSS31AttackComplexity;
          break;
        case "PR":
          metrics.privilegesRequired = reverseAbbrev.PR[
            value as keyof typeof reverseAbbrev.PR
          ] as CVSS31PrivilegesRequired;
          break;
        case "UI":
          metrics.userInteraction = reverseAbbrev.UI[
            value as keyof typeof reverseAbbrev.UI
          ] as CVSS31UserInteraction;
          break;
        case "S":
          metrics.scope = reverseAbbrev.S[
            value as keyof typeof reverseAbbrev.S
          ] as CVSS31Scope;
          break;
        case "C":
          metrics.confidentialityImpact = reverseAbbrev.C[
            value as keyof typeof reverseAbbrev.C
          ] as CVSS31Impact;
          break;
        case "I":
          metrics.integrityImpact = reverseAbbrev.I[
            value as keyof typeof reverseAbbrev.I
          ] as CVSS31Impact;
          break;
        case "A":
          metrics.availabilityImpact = reverseAbbrev.A[
            value as keyof typeof reverseAbbrev.A
          ] as CVSS31Impact;
          break;
      }
    }

    // Validate all required fields are present
    if (
      !metrics.attackVector ||
      !metrics.attackComplexity ||
      !metrics.privilegesRequired ||
      !metrics.userInteraction ||
      !metrics.scope ||
      !metrics.confidentialityImpact ||
      !metrics.integrityImpact ||
      !metrics.availabilityImpact
    ) {
      return null;
    }

    return metrics as CVSS31BaseMetrics;
  } catch {
    return null;
  }
}

/**
 * Calculate CVSS 3.1 base score from metrics
 */
export function calculateCVSS31Score(metrics: CVSS31BaseMetrics): CVSS31Score {
  const isChanged = metrics.scope === "CHANGED";

  // Get weights
  const av = ATTACK_VECTOR_WEIGHTS[metrics.attackVector];
  const ac = ATTACK_COMPLEXITY_WEIGHTS[metrics.attackComplexity];
  const pr = isChanged
    ? PRIVILEGES_REQUIRED_WEIGHTS[metrics.privilegesRequired].changed
    : PRIVILEGES_REQUIRED_WEIGHTS[metrics.privilegesRequired].unchanged;
  const ui = USER_INTERACTION_WEIGHTS[metrics.userInteraction];

  const c = IMPACT_WEIGHTS[metrics.confidentialityImpact];
  const i = IMPACT_WEIGHTS[metrics.integrityImpact];
  const a = IMPACT_WEIGHTS[metrics.availabilityImpact];

  // Calculate ISS
  const iss = calculateISS(c, i, a);

  // Calculate Impact
  const impact = calculateImpact(iss, metrics.scope);

  // Calculate Exploitability
  const exploitability = calculateExploitability(av, ac, pr, ui);

  // Calculate Base Score
  let baseScore: number;
  if (impact <= 0) {
    baseScore = 0;
  } else if (isChanged) {
    baseScore = roundUp(Math.min(1.08 * (impact + exploitability), 10));
  } else {
    baseScore = roundUp(Math.min(impact + exploitability, 10));
  }

  return {
    baseMetrics: metrics,
    baseScore,
    vectorString: generateCVSS31VectorString(metrics),
    severity: getSeverity(baseScore),
  };
}

/**
 * Get a descriptive summary of the CVSS 3.1 score
 */
export function getCVSS31Summary(score: CVSS31Score): string {
  const m = score.baseMetrics;
  const parts: string[] = [];

  if (m.attackVector === "NETWORK") parts.push("network-exploitable");
  else if (m.attackVector === "LOCAL") parts.push("requires local access");
  else if (m.attackVector === "PHYSICAL")
    parts.push("requires physical access");

  if (m.attackComplexity === "LOW") parts.push("easy to exploit");

  if (m.privilegesRequired === "NONE") parts.push("no authentication needed");
  else if (m.privilegesRequired === "HIGH")
    parts.push("requires admin privileges");

  if (m.userInteraction === "REQUIRED") parts.push("requires user interaction");

  return parts.join(", ");
}
