/**
 * CVSS 4.0 Calculator — simplified base score calculation.
 * Full spec: https://www.first.org/cvss/v4.0/specification-document
 */
import type {
  CVSS40BaseMetrics,
  CVSS40Score,
  CVSS40AttackVector,
  CVSS40AttackComplexity,
  CVSS40AttackRequirements,
  CVSS40PrivilegesRequired,
  CVSS40UserInteraction,
  CVSS40Impact,
  CVSS40SubsequentSystemImpact,
} from "../types/risk-frameworks";
import { generateCVSS40VectorString } from "./cvss40-vector";

const AV_W: Record<CVSS40AttackVector, number> = {
  NETWORK: 0.9,
  ADJACENT: 0.65,
  LOCAL: 0.55,
  PHYSICAL: 0.2,
};
const AC_W: Record<CVSS40AttackComplexity, number> = { LOW: 0.8, HIGH: 0.45 };
const AT_W: Record<CVSS40AttackRequirements, number> = {
  NONE: 1.0,
  PRESENT: 0.75,
};
const PR_W: Record<CVSS40PrivilegesRequired, number> = {
  NONE: 0.9,
  LOW: 0.65,
  HIGH: 0.3,
};
const UI_W: Record<CVSS40UserInteraction, number> = {
  NONE: 0.9,
  PASSIVE: 0.7,
  ACTIVE: 0.55,
};
const IMP_W: Record<CVSS40Impact, number> = { NONE: 0, LOW: 0.25, HIGH: 0.6 };
const SUB_W: Record<CVSS40SubsequentSystemImpact, number> = {
  NEGLIGIBLE: 0,
  LOW: 0.15,
  HIGH: 0.4,
};

function roundUp(value: number): number {
  return Math.ceil(value * 10) / 10;
}

function getSeverity(
  score: number,
): "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score === 0) return "NONE";
  if (score < 4.0) return "LOW";
  if (score < 7.0) return "MEDIUM";
  if (score < 9.0) return "HIGH";
  return "CRITICAL";
}

export function calculateCVSS40Score(metrics: CVSS40BaseMetrics): CVSS40Score {
  const exploitability =
    AV_W[metrics.attackVector] *
    AC_W[metrics.attackComplexity] *
    AT_W[metrics.attackRequirements] *
    PR_W[metrics.privilegesRequired] *
    UI_W[metrics.userInteraction];

  const vc = IMP_W[metrics.vulnConfidentialityImpact];
  const vi = IMP_W[metrics.vulnIntegrityImpact];
  const va = IMP_W[metrics.vulnAvailabilityImpact];
  const vulnImpact = 1 - (1 - vc) * (1 - vi) * (1 - va);

  let subImpact = 0;
  if (
    metrics.subConfidentialityImpact ||
    metrics.subIntegrityImpact ||
    metrics.subAvailabilityImpact
  ) {
    const sc = metrics.subConfidentialityImpact
      ? SUB_W[metrics.subConfidentialityImpact]
      : 0;
    const si = metrics.subIntegrityImpact
      ? SUB_W[metrics.subIntegrityImpact]
      : 0;
    const sa = metrics.subAvailabilityImpact
      ? SUB_W[metrics.subAvailabilityImpact]
      : 0;
    subImpact = 1 - (1 - sc) * (1 - si) * (1 - sa);
  }

  const baseScore =
    vulnImpact <= 0
      ? 0
      : roundUp(
          Math.min(
            10 * (0.7 * exploitability + 0.3 * (vulnImpact + subImpact * 0.5)),
            10,
          ),
        );

  return {
    baseMetrics: metrics,
    baseScore,
    vectorString: generateCVSS40VectorString(metrics),
    severity: getSeverity(baseScore),
  };
}

export function getCVSS40Summary(score: CVSS40Score): string {
  const m = score.baseMetrics;
  const parts: string[] = [];
  if (m.attackVector === "NETWORK") parts.push("network-exploitable");
  else if (m.attackVector === "LOCAL") parts.push("requires local access");
  else if (m.attackVector === "PHYSICAL")
    parts.push("requires physical access");
  if (m.attackComplexity === "LOW" && m.attackRequirements === "NONE")
    parts.push("easy to exploit");
  if (m.privilegesRequired === "NONE") parts.push("no authentication needed");
  else if (m.privilegesRequired === "HIGH")
    parts.push("requires admin privileges");
  if (m.userInteraction === "ACTIVE")
    parts.push("requires active user interaction");
  else if (m.userInteraction === "PASSIVE")
    parts.push("requires passive user interaction");
  if (
    m.subConfidentialityImpact ||
    m.subIntegrityImpact ||
    m.subAvailabilityImpact
  )
    parts.push("affects subsequent systems");
  return parts.join(", ");
}
