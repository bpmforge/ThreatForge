/**
 * CVSS 3.1 Framework Constants
 */

export const CVSS31_ATTACK_VECTOR = [
  {
    value: "NETWORK",
    label: "Network (N)",
    short: "N",
    description: "Remotely exploitable via network",
    score: 0.85,
  },
  {
    value: "ADJACENT",
    label: "Adjacent (A)",
    short: "A",
    description: "Requires adjacent network access",
    score: 0.62,
  },
  {
    value: "LOCAL",
    label: "Local (L)",
    short: "L",
    description: "Requires local system access",
    score: 0.55,
  },
  {
    value: "PHYSICAL",
    label: "Physical (P)",
    short: "P",
    description: "Requires physical access",
    score: 0.2,
  },
] as const;

export const CVSS31_ATTACK_COMPLEXITY = [
  {
    value: "LOW",
    label: "Low (L)",
    short: "L",
    description: "No specialized conditions",
    score: 0.77,
  },
  {
    value: "HIGH",
    label: "High (H)",
    short: "H",
    description: "Requires specialized conditions",
    score: 0.44,
  },
] as const;

export const CVSS31_PRIVILEGES_REQUIRED = [
  {
    value: "NONE",
    label: "None (N)",
    short: "N",
    description: "No privileges needed",
    scoreUnchanged: 0.85,
    scoreChanged: 0.85,
  },
  {
    value: "LOW",
    label: "Low (L)",
    short: "L",
    description: "Basic user privileges",
    scoreUnchanged: 0.62,
    scoreChanged: 0.68,
  },
  {
    value: "HIGH",
    label: "High (H)",
    short: "H",
    description: "Significant privileges (admin)",
    scoreUnchanged: 0.27,
    scoreChanged: 0.5,
  },
] as const;

export const CVSS31_USER_INTERACTION = [
  {
    value: "NONE",
    label: "None (N)",
    short: "N",
    description: "No user interaction",
    score: 0.85,
  },
  {
    value: "REQUIRED",
    label: "Required (R)",
    short: "R",
    description: "Requires user action",
    score: 0.62,
  },
] as const;

export const CVSS31_SCOPE = [
  {
    value: "UNCHANGED",
    label: "Unchanged (U)",
    short: "U",
    description: "Impact limited to vulnerable component",
  },
  {
    value: "CHANGED",
    label: "Changed (C)",
    short: "C",
    description: "Can impact other components",
  },
] as const;

export const CVSS31_IMPACT = [
  {
    value: "NONE",
    label: "None (N)",
    short: "N",
    description: "No impact",
    score: 0,
  },
  {
    value: "LOW",
    label: "Low (L)",
    short: "L",
    description: "Limited impact",
    score: 0.22,
  },
  {
    value: "HIGH",
    label: "High (H)",
    short: "H",
    description: "Total impact",
    score: 0.56,
  },
] as const;

export const DEFAULT_CVSS31_BASE_METRICS = {
  attackVector: "NETWORK" as const,
  attackComplexity: "LOW" as const,
  privilegesRequired: "NONE" as const,
  userInteraction: "NONE" as const,
  scope: "UNCHANGED" as const,
  confidentialityImpact: "HIGH" as const,
  integrityImpact: "HIGH" as const,
  availabilityImpact: "HIGH" as const,
};
