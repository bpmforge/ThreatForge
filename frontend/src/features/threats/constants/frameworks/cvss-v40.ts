/**
 * CVSS 4.0 Framework Constants
 */

export const CVSS40_ATTACK_VECTOR = [
  {
    value: "NETWORK",
    label: "Network (N)",
    short: "N",
    description: "Remotely exploitable via network",
  },
  {
    value: "ADJACENT",
    label: "Adjacent (A)",
    short: "A",
    description: "Requires adjacent network",
  },
  {
    value: "LOCAL",
    label: "Local (L)",
    short: "L",
    description: "Requires local access",
  },
  {
    value: "PHYSICAL",
    label: "Physical (P)",
    short: "P",
    description: "Requires physical access",
  },
] as const;

export const CVSS40_ATTACK_COMPLEXITY = [
  {
    value: "LOW",
    label: "Low (L)",
    short: "L",
    description: "No specialized conditions required",
  },
  {
    value: "HIGH",
    label: "High (H)",
    short: "H",
    description: "Requires specific conditions",
  },
] as const;

export const CVSS40_ATTACK_REQUIREMENTS = [
  {
    value: "NONE",
    label: "None (N)",
    short: "N",
    description: "No deployment/execution prerequisites",
  },
  {
    value: "PRESENT",
    label: "Present (P)",
    short: "P",
    description: "Specific prerequisites required",
  },
] as const;

export const CVSS40_PRIVILEGES_REQUIRED = [
  {
    value: "NONE",
    label: "None (N)",
    short: "N",
    description: "No privileges needed",
  },
  {
    value: "LOW",
    label: "Low (L)",
    short: "L",
    description: "Basic user privileges",
  },
  {
    value: "HIGH",
    label: "High (H)",
    short: "H",
    description: "Significant privileges (admin)",
  },
] as const;

export const CVSS40_USER_INTERACTION = [
  {
    value: "NONE",
    label: "None (N)",
    short: "N",
    description: "No user interaction",
  },
  {
    value: "PASSIVE",
    label: "Passive (P)",
    short: "P",
    description: "Involuntary user interaction",
  },
  {
    value: "ACTIVE",
    label: "Active (A)",
    short: "A",
    description: "User must actively interact",
  },
] as const;

export const CVSS40_IMPACT = [
  { value: "NONE", label: "None (N)", short: "N", description: "No impact" },
  { value: "LOW", label: "Low (L)", short: "L", description: "Limited impact" },
  { value: "HIGH", label: "High (H)", short: "H", description: "Total impact" },
] as const;

export const DEFAULT_CVSS40_BASE_METRICS = {
  attackVector: "NETWORK" as const,
  attackComplexity: "LOW" as const,
  attackRequirements: "NONE" as const,
  privilegesRequired: "NONE" as const,
  userInteraction: "NONE" as const,
  vulnConfidentialityImpact: "HIGH" as const,
  vulnIntegrityImpact: "HIGH" as const,
  vulnAvailabilityImpact: "HIGH" as const,
};
