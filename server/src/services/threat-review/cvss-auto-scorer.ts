/**
 * CVSS Auto-Scorer
 *
 * Derives CVSS 3.1 and 4.0 vectors from threat metadata
 * (STRIDE category, severity, attack vector description, component trust level).
 * Uses the existing cvss-calculator.ts for score computation.
 *
 * Also generates NVD calculator links for human review.
 */
import { calculateCVSS31 } from "../attack-surface/cvss-calculator.js";
import type { CVSS31Vector } from "../attack-surface/types.js";
import type { MicroThreat } from "../ai/micro-analysis/types.js";

export interface CVSSResult {
  vector31: string;
  score31: number;
  vector40: string;
  score40: number;
  nvdLink31: string;
  nvdLink40: string;
}

// STRIDE category → CIA impact mapping
const STRIDE_IMPACT: Record<
  string,
  { C: "N" | "L" | "H"; I: "N" | "L" | "H"; A: "N" | "L" | "H" }
> = {
  SPOOFING: { C: "H", I: "L", A: "N" }, // Identity compromise → confidentiality
  TAMPERING: { C: "N", I: "H", A: "L" }, // Data modification → integrity
  REPUDIATION: { C: "L", I: "L", A: "N" }, // Accountability gap → lower impact
  INFORMATION_DISCLOSURE: { C: "H", I: "N", A: "N" }, // Data leak → confidentiality
  DENIAL_OF_SERVICE: { C: "N", I: "N", A: "H" }, // Availability loss
  ELEVATION_OF_PRIVILEGE: { C: "H", I: "H", A: "L" }, // Full compromise potential
};

// Severity → exploitability calibration
const SEVERITY_CALIBRATION: Record<
  string,
  { AC: "L" | "H"; PR: "N" | "L" | "H" }
> = {
  CRITICAL: { AC: "L", PR: "N" }, // Easy to exploit, no privileges
  HIGH: { AC: "L", PR: "L" }, // Easy but needs some access
  MEDIUM: { AC: "H", PR: "L" }, // Harder to exploit
  LOW: { AC: "H", PR: "H" }, // Difficult, needs high privileges
};

/**
 * Auto-generate CVSS 3.1 and 4.0 scores from a MicroThreat.
 */
export function autoScoreThreat(threat: MicroThreat): CVSSResult {
  const impacts = STRIDE_IMPACT[threat.category] || {
    C: "L",
    I: "L",
    A: "L",
  };
  const calibration = SEVERITY_CALIBRATION[threat.severity] || {
    AC: "L",
    PR: "L",
  };

  // Determine attack vector from component trust/exposure
  const av = inferAttackVector(threat);

  const vector31: CVSS31Vector = {
    attackVector: av,
    attackComplexity: calibration.AC,
    privilegesRequired: calibration.PR,
    userInteraction: "N",
    scope: threat.category === "ELEVATION_OF_PRIVILEGE" ? "C" : "U",
    confidentialityImpact: impacts.C,
    integrityImpact: impacts.I,
    availabilityImpact: impacts.A,
  };

  const result31 = calculateCVSS31(vector31);

  // CVSS 4.0 — simplified mapping (uses same base metrics + AT)
  const vector40String = buildCVSS40Vector(vector31);
  const score40 = estimateCVSS40Score(result31.baseScore);

  return {
    vector31: result31.vector,
    score31: result31.baseScore,
    vector40: vector40String,
    score40,
    nvdLink31: `https://www.first.org/cvss/calculator/3.1#${result31.vector}`,
    nvdLink40: `https://www.first.org/cvss/calculator/4.0#${vector40String}`,
  };
}

/**
 * Infer CVSS attack vector from threat context.
 */
function inferAttackVector(threat: MicroThreat): CVSS31Vector["attackVector"] {
  const desc = (
    threat.description +
    " " +
    (threat.evidence.attackPath || "")
  ).toLowerCase();

  // Check for network-level indicators
  if (
    desc.includes("internet") ||
    desc.includes("external") ||
    desc.includes("public") ||
    desc.includes("remote") ||
    desc.includes("api gateway")
  ) {
    return "N"; // Network
  }
  if (
    desc.includes("adjacent") ||
    desc.includes("internal network") ||
    desc.includes("same network")
  ) {
    return "A"; // Adjacent
  }
  if (desc.includes("physical") || desc.includes("local access")) {
    return "P"; // Physical
  }

  // Default based on severity
  return threat.severity === "CRITICAL" || threat.severity === "HIGH"
    ? "N"
    : "A";
}

/**
 * Build a CVSS 4.0 vector string from 3.1 components.
 * CVSS 4.0 adds Attack Requirements (AT) and splits Scope into
 * Subsequent System impacts, but the base metrics are similar.
 */
function buildCVSS40Vector(v31: CVSS31Vector): string {
  // Map 3.1 → 4.0 attack requirements
  const at = v31.attackComplexity === "H" ? "P" : "N"; // Present or None

  // In CVSS 4.0, scope changed → subsequent system impact
  const vc = v31.confidentialityImpact;
  const vi = v31.integrityImpact;
  const va = v31.availabilityImpact;

  // Subsequent system impact (only if scope changed in 3.1)
  const sc = v31.scope === "C" ? v31.confidentialityImpact : "N";
  const si = v31.scope === "C" ? v31.integrityImpact : "N";
  const sa = v31.scope === "C" ? v31.availabilityImpact : "N";

  return (
    `CVSS:4.0/AV:${v31.attackVector}/AC:${v31.attackComplexity}` +
    `/AT:${at}/PR:${v31.privilegesRequired}/UI:${v31.userInteraction}` +
    `/VC:${vc}/VI:${vi}/VA:${va}/SC:${sc}/SI:${si}/SA:${sa}`
  );
}

/**
 * Estimate CVSS 4.0 score from 3.1 base score.
 * Full 4.0 uses macrovector lookup tables — this is a simplified mapping.
 */
function estimateCVSS40Score(cvss31Score: number): number {
  // CVSS 4.0 scores tend to be slightly lower than 3.1 for the same vector
  // due to the more granular metric system. Apply a ~5% reduction.
  const adjusted = cvss31Score * 0.95;
  return Math.round(adjusted * 10) / 10;
}
