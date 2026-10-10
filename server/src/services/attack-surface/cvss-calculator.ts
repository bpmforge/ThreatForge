/**
 * CVSS v3.1 Calculator
 *
 * Implements CVSS v3.1 base score calculation according to the specification.
 * Reference: https://www.first.org/cvss/v3.1/specification-document
 */

import type { CVSS31Vector, CVSSCalculation } from "./types.js";

// CVSS v3.1 metric weights
const ATTACK_VECTOR_WEIGHTS = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const ATTACK_COMPLEXITY_WEIGHTS = { L: 0.77, H: 0.44 };
const PRIVILEGES_REQUIRED_WEIGHTS_UNCHANGED = { N: 0.85, L: 0.62, H: 0.27 };
const PRIVILEGES_REQUIRED_WEIGHTS_CHANGED = { N: 0.85, L: 0.68, H: 0.5 };
const USER_INTERACTION_WEIGHTS = { N: 0.85, R: 0.62 };
const IMPACT_WEIGHTS = { N: 0, L: 0.22, H: 0.56 };

/**
 * Calculate CVSS v3.1 base score from vector components.
 */
export function calculateCVSS31(vector: CVSS31Vector): CVSSCalculation {
  const { scope } = vector;
  const scopeChanged = scope === "C";

  // Calculate exploitability sub-score
  const av = ATTACK_VECTOR_WEIGHTS[vector.attackVector];
  const ac = ATTACK_COMPLEXITY_WEIGHTS[vector.attackComplexity];
  const pr = scopeChanged
    ? PRIVILEGES_REQUIRED_WEIGHTS_CHANGED[vector.privilegesRequired]
    : PRIVILEGES_REQUIRED_WEIGHTS_UNCHANGED[vector.privilegesRequired];
  const ui = USER_INTERACTION_WEIGHTS[vector.userInteraction];

  const exploitability = 8.22 * av * ac * pr * ui;

  // Calculate impact sub-score
  const confImpact = IMPACT_WEIGHTS[vector.confidentialityImpact];
  const integImpact = IMPACT_WEIGHTS[vector.integrityImpact];
  const availImpact = IMPACT_WEIGHTS[vector.availabilityImpact];

  const iscBase = 1 - (1 - confImpact) * (1 - integImpact) * (1 - availImpact);

  let impact: number;
  if (scopeChanged) {
    impact = 7.52 * (iscBase - 0.029) - 3.25 * Math.pow(iscBase - 0.02, 15);
  } else {
    impact = 6.42 * iscBase;
  }

  // Calculate base score
  let baseScore: number;
  if (impact <= 0) {
    baseScore = 0;
  } else if (scopeChanged) {
    baseScore = Math.min(1.08 * (impact + exploitability), 10);
  } else {
    baseScore = Math.min(impact + exploitability, 10);
  }

  // Round up to nearest 0.1
  baseScore = Math.ceil(baseScore * 10) / 10;

  // Determine severity
  const severity = getSeverity(baseScore);

  // Generate vector string
  const vectorString = generateVectorString(vector);

  return {
    vector: vectorString,
    baseScore,
    severity,
    impactScore: Math.round(impact * 10) / 10,
    exploitabilityScore: Math.round(exploitability * 10) / 10,
  };
}

/**
 * Get severity rating from base score.
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
 * Generate CVSS v3.1 vector string.
 */
function generateVectorString(vector: CVSS31Vector): string {
  return (
    `CVSS:3.1/AV:${vector.attackVector}/AC:${vector.attackComplexity}` +
    `/PR:${vector.privilegesRequired}/UI:${vector.userInteraction}` +
    `/S:${vector.scope}/C:${vector.confidentialityImpact}` +
    `/I:${vector.integrityImpact}/A:${vector.availabilityImpact}`
  );
}

/**
 * Estimate CVSS vector from interface properties.
 */
export function estimateCVSSFromInterface(options: {
  networkExposure:
    | "INTERNAL_ONLY"
    | "VPN_PROTECTED"
    | "PRIVATE_CLOUD"
    | "PUBLIC_CLOUD"
    | "INTERNET_FACING";
  authLevel:
    | "NONE"
    | "API_KEY"
    | "BASIC"
    | "OAUTH2"
    | "MUTUAL_TLS"
    | "CERTIFICATE"
    | "MULTI_FACTOR";
  dataSensitivity:
    | "PUBLIC"
    | "INTERNAL"
    | "CONFIDENTIAL"
    | "RESTRICTED"
    | "CRITICAL";
  dataFlow: "IN" | "OUT" | "BIDIRECTIONAL";
}): CVSS31Vector {
  const { networkExposure, authLevel, dataSensitivity, dataFlow } = options;

  // Estimate Attack Vector based on network exposure
  let attackVector: CVSS31Vector["attackVector"];
  switch (networkExposure) {
    case "INTERNET_FACING":
    case "PUBLIC_CLOUD":
      attackVector = "N";
      break;
    case "PRIVATE_CLOUD":
    case "VPN_PROTECTED":
      attackVector = "A";
      break;
    case "INTERNAL_ONLY":
      attackVector = "L";
      break;
    default:
      attackVector = "N";
  }

  // Estimate Attack Complexity (default to Low for most cases)
  const attackComplexity: CVSS31Vector["attackComplexity"] = "L";

  // Estimate Privileges Required based on auth level
  let privilegesRequired: CVSS31Vector["privilegesRequired"];
  switch (authLevel) {
    case "NONE":
      privilegesRequired = "N";
      break;
    case "API_KEY":
    case "BASIC":
      privilegesRequired = "L";
      break;
    default:
      privilegesRequired = "H";
  }

  // User Interaction typically None for API interfaces
  const userInteraction: CVSS31Vector["userInteraction"] = "N";

  // Scope typically Unchanged
  const scope: CVSS31Vector["scope"] = "U";

  // Estimate impacts based on data sensitivity and flow
  let confidentialityImpact: CVSS31Vector["confidentialityImpact"];
  let integrityImpact: CVSS31Vector["integrityImpact"];
  let availabilityImpact: CVSS31Vector["availabilityImpact"];

  // Confidentiality based on sensitivity and outbound data
  if (dataFlow === "OUT" || dataFlow === "BIDIRECTIONAL") {
    switch (dataSensitivity) {
      case "CRITICAL":
      case "RESTRICTED":
        confidentialityImpact = "H";
        break;
      case "CONFIDENTIAL":
        confidentialityImpact = "L";
        break;
      default:
        confidentialityImpact = "N";
    }
  } else {
    confidentialityImpact = "N";
  }

  // Integrity based on inbound data
  if (dataFlow === "IN" || dataFlow === "BIDIRECTIONAL") {
    switch (dataSensitivity) {
      case "CRITICAL":
      case "RESTRICTED":
        integrityImpact = "H";
        break;
      case "CONFIDENTIAL":
      case "INTERNAL":
        integrityImpact = "L";
        break;
      default:
        integrityImpact = "N";
    }
  } else {
    integrityImpact = "N";
  }

  // Availability impact based on criticality
  switch (dataSensitivity) {
    case "CRITICAL":
      availabilityImpact = "H";
      break;
    case "RESTRICTED":
    case "CONFIDENTIAL":
      availabilityImpact = "L";
      break;
    default:
      availabilityImpact = "N";
  }

  return {
    attackVector,
    attackComplexity,
    privilegesRequired,
    userInteraction,
    scope,
    confidentialityImpact,
    integrityImpact,
    availabilityImpact,
  };
}
