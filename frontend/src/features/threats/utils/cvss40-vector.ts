import type { CVSS40BaseMetrics } from "../types/risk-frameworks";

const VECTOR_ABBREV = {
  attackVector: { NETWORK: "N", ADJACENT: "A", LOCAL: "L", PHYSICAL: "P" },
  attackComplexity: { LOW: "L", HIGH: "H" },
  attackRequirements: { NONE: "N", PRESENT: "P" },
  privilegesRequired: { NONE: "N", LOW: "L", HIGH: "H" },
  userInteraction: { NONE: "N", PASSIVE: "P", ACTIVE: "A" },
  impact: { NONE: "N", LOW: "L", HIGH: "H" },
  subsequentImpact: { NEGLIGIBLE: "N", LOW: "L", HIGH: "H" },
} as const;

export function generateCVSS40VectorString(metrics: CVSS40BaseMetrics): string {
  const parts = [
    "CVSS:4.0",
    `AV:${VECTOR_ABBREV.attackVector[metrics.attackVector]}`,
    `AC:${VECTOR_ABBREV.attackComplexity[metrics.attackComplexity]}`,
    `AT:${VECTOR_ABBREV.attackRequirements[metrics.attackRequirements]}`,
    `PR:${VECTOR_ABBREV.privilegesRequired[metrics.privilegesRequired]}`,
    `UI:${VECTOR_ABBREV.userInteraction[metrics.userInteraction]}`,
    `VC:${VECTOR_ABBREV.impact[metrics.vulnConfidentialityImpact]}`,
    `VI:${VECTOR_ABBREV.impact[metrics.vulnIntegrityImpact]}`,
    `VA:${VECTOR_ABBREV.impact[metrics.vulnAvailabilityImpact]}`,
  ];
  if (metrics.subConfidentialityImpact)
    parts.push(
      `SC:${VECTOR_ABBREV.subsequentImpact[metrics.subConfidentialityImpact]}`,
    );
  if (metrics.subIntegrityImpact)
    parts.push(
      `SI:${VECTOR_ABBREV.subsequentImpact[metrics.subIntegrityImpact]}`,
    );
  if (metrics.subAvailabilityImpact)
    parts.push(
      `SA:${VECTOR_ABBREV.subsequentImpact[metrics.subAvailabilityImpact]}`,
    );
  return parts.join("/");
}
