/**
 * Risk Framework Constants
 *
 * Re-exports all framework constants from per-framework sub-modules.
 * See ./frameworks/ for individual framework files.
 */

import type {
  RiskFrameworkOption,
  RiskFramework,
} from "../types/risk-frameworks";

// ============================================================================
// Available Frameworks
// ============================================================================

export const RISK_FRAMEWORKS: RiskFrameworkOption[] = [
  {
    value: "CIA_TRIAD",
    label: "CIA Triad",
    shortLabel: "CIA",
    description: "Confidentiality, Integrity, Availability impact assessment",
  },
  {
    value: "CVSS_3_1",
    label: "CVSS 3.1",
    shortLabel: "CVSS 3.1",
    description: "Common Vulnerability Scoring System version 3.1",
  },
  {
    value: "CVSS_4_0",
    label: "CVSS 4.0",
    shortLabel: "CVSS 4.0",
    description: "Common Vulnerability Scoring System version 4.0 (latest)",
  },
  {
    value: "DREAD",
    label: "DREAD",
    shortLabel: "DREAD",
    description:
      "Damage, Reproducibility, Exploitability, Affected Users, Discoverability",
  },
  {
    value: "OWASP_RISK_RATING",
    label: "OWASP Risk Rating",
    shortLabel: "OWASP",
    description:
      "OWASP Risk Rating Methodology with likelihood and impact factors",
  },
  {
    value: "FAIR",
    label: "FAIR",
    shortLabel: "FAIR",
    description:
      "Factor Analysis of Information Risk — translates threats into dollar amounts (ALE)",
  },
];

export const DEFAULT_ENABLED_FRAMEWORKS: RiskFramework[] = [
  "CIA_TRIAD",
  "CVSS_3_1",
];

export * from "./frameworks";
