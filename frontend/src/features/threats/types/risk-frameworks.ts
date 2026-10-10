/**
 * Risk Framework Types
 *
 * Supports multiple security risk scoring frameworks:
 * - CIA Triad (Confidentiality, Integrity, Availability)
 * - CVSS 3.1 (Common Vulnerability Scoring System)
 * - CVSS 4.0 (Latest version)
 * - DREAD (Damage, Reproducibility, Exploitability, Affected Users, Discoverability)
 * - OWASP Risk Rating
 */

// ============================================================================
// Framework Types
// ============================================================================

export type RiskFramework =
  | "CIA_TRIAD"
  | "CVSS_3_1"
  | "CVSS_4_0"
  | "DREAD"
  | "OWASP_RISK_RATING"
  | "FAIR";

// ============================================================================
// CIA Triad Types
// ============================================================================

export type CIALevel = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface CIATriadScore {
  confidentiality: CIALevel;
  integrity: CIALevel;
  availability: CIALevel;
}

// ============================================================================
// CVSS 3.1 Types
// ============================================================================

export type CVSS31AttackVector = "NETWORK" | "ADJACENT" | "LOCAL" | "PHYSICAL";
export type CVSS31AttackComplexity = "LOW" | "HIGH";
export type CVSS31PrivilegesRequired = "NONE" | "LOW" | "HIGH";
export type CVSS31UserInteraction = "NONE" | "REQUIRED";
export type CVSS31Scope = "UNCHANGED" | "CHANGED";
export type CVSS31Impact = "NONE" | "LOW" | "HIGH";

export interface CVSS31BaseMetrics {
  attackVector: CVSS31AttackVector;
  attackComplexity: CVSS31AttackComplexity;
  privilegesRequired: CVSS31PrivilegesRequired;
  userInteraction: CVSS31UserInteraction;
  scope: CVSS31Scope;
  confidentialityImpact: CVSS31Impact;
  integrityImpact: CVSS31Impact;
  availabilityImpact: CVSS31Impact;
}

export interface CVSS31Score {
  baseMetrics: CVSS31BaseMetrics;
  baseScore: number;
  vectorString: string;
  severity: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

// ============================================================================
// CVSS 4.0 Types
// ============================================================================

export type CVSS40AttackVector = "NETWORK" | "ADJACENT" | "LOCAL" | "PHYSICAL";
export type CVSS40AttackComplexity = "LOW" | "HIGH";
export type CVSS40AttackRequirements = "NONE" | "PRESENT";
export type CVSS40PrivilegesRequired = "NONE" | "LOW" | "HIGH";
export type CVSS40UserInteraction = "NONE" | "PASSIVE" | "ACTIVE";
export type CVSS40Impact = "NONE" | "LOW" | "HIGH";

// CVSS 4.0 Supplemental Metrics
export type CVSS40SubsequentSystemImpact = "NEGLIGIBLE" | "LOW" | "HIGH";

export interface CVSS40BaseMetrics {
  // Exploitability Metrics
  attackVector: CVSS40AttackVector;
  attackComplexity: CVSS40AttackComplexity;
  attackRequirements: CVSS40AttackRequirements;
  privilegesRequired: CVSS40PrivilegesRequired;
  userInteraction: CVSS40UserInteraction;
  // Vulnerable System Impact
  vulnConfidentialityImpact: CVSS40Impact;
  vulnIntegrityImpact: CVSS40Impact;
  vulnAvailabilityImpact: CVSS40Impact;
  // Subsequent System Impact (optional)
  subConfidentialityImpact?: CVSS40SubsequentSystemImpact;
  subIntegrityImpact?: CVSS40SubsequentSystemImpact;
  subAvailabilityImpact?: CVSS40SubsequentSystemImpact;
}

export interface CVSS40Score {
  baseMetrics: CVSS40BaseMetrics;
  baseScore: number;
  vectorString: string;
  severity: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

// ============================================================================
// DREAD Types
// ============================================================================

export type DREADRating = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface DREADMetrics {
  damage: DREADRating;
  reproducibility: DREADRating;
  exploitability: DREADRating;
  affectedUsers: DREADRating;
  discoverability: DREADRating;
}

export interface DREADScore {
  metrics: DREADMetrics;
  totalScore: number;
  averageScore: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

// ============================================================================
// OWASP Risk Rating Types
// ============================================================================

export type OWASPLikelihoodFactor = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface OWASPThreatAgentFactors {
  skillLevel: OWASPLikelihoodFactor;
  motive: OWASPLikelihoodFactor;
  opportunity: OWASPLikelihoodFactor;
  size: OWASPLikelihoodFactor;
}

export interface OWASPVulnerabilityFactors {
  easeOfDiscovery: OWASPLikelihoodFactor;
  easeOfExploit: OWASPLikelihoodFactor;
  awareness: OWASPLikelihoodFactor;
  intrusionDetection: OWASPLikelihoodFactor;
}

export interface OWASPTechnicalImpactFactors {
  lossOfConfidentiality: OWASPLikelihoodFactor;
  lossOfIntegrity: OWASPLikelihoodFactor;
  lossOfAvailability: OWASPLikelihoodFactor;
  lossOfAccountability: OWASPLikelihoodFactor;
}

export interface OWASPBusinessImpactFactors {
  financialDamage: OWASPLikelihoodFactor;
  reputationDamage: OWASPLikelihoodFactor;
  nonCompliance: OWASPLikelihoodFactor;
  privacyViolation: OWASPLikelihoodFactor;
}

export interface OWASPRiskRatingMetrics {
  threatAgentFactors: OWASPThreatAgentFactors;
  vulnerabilityFactors: OWASPVulnerabilityFactors;
  technicalImpactFactors: OWASPTechnicalImpactFactors;
  businessImpactFactors: OWASPBusinessImpactFactors;
}

export interface OWASPRiskRatingScore {
  metrics: OWASPRiskRatingMetrics;
  likelihoodScore: number;
  technicalImpactScore: number;
  businessImpactScore: number;
  overallRiskScore: number;
  riskLevel: "NOTE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

// ============================================================================
// FAIR Types
// ============================================================================

export interface FAIRFactors {
  /** Times per year an attacker attempts this threat */
  threatEventFrequency: number;
  /** Probability attacker succeeds (0–1) */
  vulnerability: number;
  /** Direct cost in dollars */
  primaryLoss: number;
  /** Probability of secondary loss event (0–1) */
  secondaryLossEventFrequency: number;
  /** Secondary cost: fines, reputation, etc. ($) */
  secondaryLoss: number;
}

export interface FAIRScore {
  factors: FAIRFactors;
  lossEventFrequency: number;
  singleLossExpectancy: number;
  annualizedLossExpectancy: number;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

// ============================================================================
// Combined Risk Scores
// ============================================================================

export interface ThreatRiskScores {
  enabledFrameworks: RiskFramework[];
  ciaTriad?: CIATriadScore;
  cvss31?: CVSS31Score;
  cvss40?: CVSS40Score;
  dread?: DREADScore;
  owaspRiskRating?: OWASPRiskRatingScore;
  fair?: FAIRScore;
}

// ============================================================================
// UI Option Types
// ============================================================================

export interface RiskFrameworkOption {
  value: RiskFramework;
  label: string;
  shortLabel: string;
  description: string;
}

export interface CIALevelOption {
  value: CIALevel;
  label: string;
  description: string;
  numericValue: number;
}
