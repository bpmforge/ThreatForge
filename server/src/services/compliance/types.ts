/**
 * Compliance Analysis Types
 *
 * Definitions for compliance frameworks and gap analysis.
 */

/** Supported compliance frameworks */
export type ComplianceFramework =
  | "SOC2"
  | "ISO27001"
  | "NIST_CSF"
  | "NIST_800_53"
  | "FIPS_140"
  | "FIPS_199"
  | "PCI_DSS"
  | "HIPAA"
  | "GDPR"
  | "CIS_CONTROLS"
  | "OWASP_ASVS"
  | "FEDRAMP"
  | "CMMC"
  | "NIST_800_171"
  | "ISO_27701"
  | "CCPA"
  | "FDA_CYBER"
  | "CUSTOM"; // For user-defined frameworks

/** Compliance control status */
export type ControlStatus =
  | "NOT_ADDRESSED"
  | "PARTIALLY_ADDRESSED"
  | "FULLY_ADDRESSED"
  | "NOT_APPLICABLE";

/** Compliance control category */
export interface ControlCategory {
  id: string;
  name: string;
  description: string;
  controls: ComplianceControl[];
}

/** Individual compliance control */
export interface ComplianceControl {
  id: string;
  name: string;
  description: string;
  category: string;
  framework: ComplianceFramework;
  /** STRIDE categories this control addresses */
  strideCategories: string[];
  /** Keywords that indicate this control is addressed */
  keywords: string[];
  /** Severity if not addressed */
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

/** Control assessment result */
export interface ControlAssessment {
  control: ComplianceControl;
  status: ControlStatus;
  /** Threats that address this control */
  addressingThreats: string[];
  /** Mitigations that address this control */
  addressingMitigations: string[];
  /** Coverage percentage (0-100) */
  coverage: number;
  /** Gap description if not fully addressed */
  gap?: string;
  /** Recommended actions */
  recommendations: string[];
}

/** Category assessment result */
export interface CategoryAssessment {
  category: ControlCategory;
  controls: ControlAssessment[];
  /** Overall category status */
  status: ControlStatus;
  /** Number of controls by status */
  summary: {
    total: number;
    notAddressed: number;
    partiallyAddressed: number;
    fullyAddressed: number;
    notApplicable: number;
  };
  /** Category coverage percentage */
  coverage: number;
}

/** Overall compliance analysis result */
export interface ComplianceAnalysis {
  modelId: string;
  modelName: string;
  framework: ComplianceFramework;
  analyzedAt: string;
  /** Overall compliance score (0-100) */
  overallScore: number;
  /** Overall status */
  overallStatus: ControlStatus;
  /** Summary statistics */
  summary: {
    totalControls: number;
    notAddressed: number;
    partiallyAddressed: number;
    fullyAddressed: number;
    notApplicable: number;
    criticalGaps: number;
    highGaps: number;
    mediumGaps: number;
    lowGaps: number;
  };
  /** Assessment by category */
  categories: CategoryAssessment[];
  /** Top gaps that need attention */
  topGaps: ControlAssessment[];
  /** Compliance trend data (if historical data available) */
  trend?: {
    previousScore: number;
    change: number;
    direction: "UP" | "DOWN" | "STABLE";
  };
}

/** Gap report for export */
export interface GapReport {
  modelId: string;
  modelName: string;
  framework: ComplianceFramework;
  generatedAt: string;
  executiveSummary: string;
  overallScore: number;
  gaps: Array<{
    controlId: string;
    controlName: string;
    category: string;
    severity: string;
    gap: string;
    recommendations: string[];
    effort: "LOW" | "MEDIUM" | "HIGH";
  }>;
  recommendations: string[];
}
