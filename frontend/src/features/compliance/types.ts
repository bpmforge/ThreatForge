export type { Framework, ComplianceGap, ComplianceAnalysis };

type ComplianceStatus = "NOT_ADDRESSED" | "PARTIAL" | "COVERED";

/** Built-in compliance frameworks */
type BuiltInFramework =
  | "SOC2"
  | "ISO27001"
  | "NIST_CSF"
  | "NIST_800_53"
  | "FIPS_140"
  | "FIPS_199"
  | "HIPAA"
  | "PCI_DSS"
  | "GDPR"
  | "CIS_CONTROLS"
  | "OWASP_ASVS"
  | "FEDRAMP"
  | "CMMC"
  | "NIST_800_171"
  | "ISO_27701"
  | "CCPA"
  | "FDA_CYBER";

/** Framework can be built-in or custom (prefixed with 'custom:') */
type Framework = BuiltInFramework | `custom:${string}`;

interface ComplianceGap extends Record<string, unknown> {
  controlId: string;
  controlName: string;
  framework: Framework;
  status: ComplianceStatus;
  recommendedActions: string[];
}

interface ComplianceAnalysis extends Record<string, unknown> {
  modelId: string;
  framework: Framework;
  totalControls: number;
  coveredControls: number;
  partialControls: number;
  gaps: ComplianceGap[];
  coveragePercentage: number;
  lastAnalyzed: string;
}
