/**
 * CIA Triad Impact Utilities
 *
 * The CIA Triad is the foundational security model:
 * - Confidentiality: Protecting information from unauthorized disclosure
 * - Integrity: Ensuring data accuracy and trustworthiness
 * - Availability: Ensuring authorized access when needed
 */

import type { CIATriadScore, CIALevel } from "../types/risk-frameworks";

/**
 * Numeric values for CIA levels
 */
const CIA_LEVEL_VALUES: Record<CIALevel, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

/**
 * Get the highest impact level from CIA triad
 */
function getMaxCIALevel(score: CIATriadScore): CIALevel {
  const levels: CIALevel[] = [
    score.confidentiality,
    score.integrity,
    score.availability,
  ];
  let maxLevel: CIALevel = "NONE";
  let maxValue = 0;

  for (const level of levels) {
    const value = CIA_LEVEL_VALUES[level];
    if (value > maxValue) {
      maxValue = value;
      maxLevel = level;
    }
  }

  return maxLevel;
}

/**
 * Calculate overall CIA impact score (0-10 scale)
 */
export function calculateCIAImpactScore(score: CIATriadScore): number {
  const c = CIA_LEVEL_VALUES[score.confidentiality];
  const i = CIA_LEVEL_VALUES[score.integrity];
  const a = CIA_LEVEL_VALUES[score.availability];

  // Weighted average (all equal weight) mapped to 0-10 scale
  const average = (c + i + a) / 3;
  return Math.round((average / 4) * 10 * 10) / 10;
}

/**
 * Get color class for CIA level
 */
export function getCIALevelColor(level: CIALevel): string {
  switch (level) {
    case "NONE":
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
 * Generate a summary of CIA impact
 */
export function getCIATriadSummary(score: CIATriadScore): string {
  const parts: string[] = [];
  const maxLevel = getMaxCIALevel(score);

  // Identify which dimensions are at max level
  if (score.confidentiality === maxLevel && maxLevel !== "NONE") {
    parts.push("confidentiality");
  }
  if (score.integrity === maxLevel && maxLevel !== "NONE") {
    parts.push("integrity");
  }
  if (score.availability === maxLevel && maxLevel !== "NONE") {
    parts.push("availability");
  }

  if (maxLevel === "NONE") {
    return "No significant security impact";
  }

  if (maxLevel === "CRITICAL") {
    return `Critical impact on ${parts.join(" and ")}`;
  }

  if (maxLevel === "HIGH") {
    return `High impact on ${parts.join(" and ")}`;
  }

  if (maxLevel === "MEDIUM") {
    return `Moderate impact on ${parts.join(" and ")}`;
  }

  return `Low impact on ${parts.join(" and ")}`;
}
