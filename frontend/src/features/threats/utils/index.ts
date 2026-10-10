/**
 * Risk Framework Utilities
 *
 * Exports all calculators and utilities for risk scoring frameworks.
 */

// CVSS 3.1
export { calculateCVSS31Score, getCVSS31Summary } from "./cvss31-calculator";

// CVSS 4.0
export { calculateCVSS40Score, getCVSS40Summary } from "./cvss40-calculator";

// DREAD
export {
  calculateDREADScore,
  getDREADSeverityColor,
  getDREADSummary,
} from "./dread-calculator";

// OWASP Risk Rating
export {
  calculateOWASPRiskRating,
  getOWASPRiskColor,
  getOWASPRiskSummary,
  getOWASPRiskBreakdown,
} from "./owasp-risk-calculator";

// CIA Triad
export {
  calculateCIAImpactScore,
  getCIALevelColor,
  getCIATriadSummary,
} from "./cia-triad";
