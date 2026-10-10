/**
 * CIA Triad Framework Constants
 */

import type { CIALevelOption, CIALevel } from "../../types/risk-frameworks";

export const CIA_LEVELS: CIALevelOption[] = [
  { value: "NONE", label: "None", description: "No impact", numericValue: 0 },
  {
    value: "LOW",
    label: "Low",
    description: "Limited impact",
    numericValue: 1,
  },
  {
    value: "MEDIUM",
    label: "Medium",
    description: "Moderate impact",
    numericValue: 2,
  },
  {
    value: "HIGH",
    label: "High",
    description: "Significant impact",
    numericValue: 3,
  },
  {
    value: "CRITICAL",
    label: "Critical",
    description: "Severe/catastrophic impact",
    numericValue: 4,
  },
];

export const CIA_TRIAD_DESCRIPTIONS = {
  confidentiality:
    "Impact on data secrecy - unauthorized disclosure of information",
  integrity:
    "Impact on data accuracy - unauthorized modification of information",
  availability:
    "Impact on system access - denial of authorized access to information",
};

export const DEFAULT_CIA_TRIAD = {
  confidentiality: "MEDIUM" as CIALevel,
  integrity: "MEDIUM" as CIALevel,
  availability: "MEDIUM" as CIALevel,
};
