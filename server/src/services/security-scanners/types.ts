/**
 * Security Scanner Integration Types
 *
 * Type definitions for SAST/DAST scanner integrations.
 */

/** Supported scanner types */
export type ScannerType =
  | "SNYK"
  | "SONARQUBE"
  | "CHECKMARX"
  | "VERACODE"
  | "OWASP_ZAP"
  | "BURP"
  | "CUSTOM";

/** Severity levels normalized across scanners */
export type NormalizedSeverity =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "INFO";

/** Scanner finding category */
export type FindingCategory =
  | "VULNERABILITY"
  | "CODE_SMELL"
  | "BUG"
  | "SECURITY_HOTSPOT"
  | "LICENSE"
  | "DEPENDENCY"
  | "CONFIGURATION";

/** Base scanner finding (normalized from any scanner) */
export interface ScannerFinding {
  /** External ID from the scanner */
  externalId: string;
  /** Scanner that produced this finding */
  scannerType: ScannerType;
  /** Finding title/name */
  title: string;
  /** Detailed description */
  description: string;
  /** Normalized severity */
  severity: NormalizedSeverity;
  /** Finding category */
  category: FindingCategory;
  /** CWE IDs if available */
  cweIds: string[];
  /** CVE IDs if available */
  cveIds: string[];
  /** OWASP category if available */
  owaspCategory?: string;
  /** File path where issue was found */
  filePath?: string;
  /** Line number in file */
  lineNumber?: number;
  /** Snippet of affected code */
  codeSnippet?: string;
  /** Component/package name for dependency issues */
  componentName?: string;
  /** Component version */
  componentVersion?: string;
  /** Fix available? */
  fixAvailable?: boolean;
  /** Suggested fix version */
  fixVersion?: string;
  /** Remediation guidance */
  remediation?: string;
  /** URL to scanner's finding page */
  externalUrl?: string;
  /** First seen timestamp */
  firstSeen: Date;
  /** Last seen timestamp */
  lastSeen: Date;
  /** Scanner-specific raw data */
  rawData?: Record<string, unknown>;
}

/** Scan run metadata */
export interface ScanRun {
  id: string;
  scannerType: ScannerType;
  projectId: string;
  threatModelId?: string;
  startedAt: Date;
  completedAt?: Date;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  error?: string;
}

/** Mapping between scanner finding and threat model component */
export interface FindingComponentMapping {
  findingId: string;
  componentId: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  mappingReason: string;
}

/** Snyk-specific types */
export interface SnykVulnerability {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  identifiers: {
    CWE: string[];
    CVE: string[];
  };
  packageName: string;
  version: string;
  fixedIn: string[];
  from: string[];
  upgradePath: string[];
  isUpgradable: boolean;
  isPatchable: boolean;
  references: { url: string; title: string }[];
}

export interface SnykTestResult {
  ok: boolean;
  vulnerabilities: SnykVulnerability[];
  dependencyCount: number;
  org: string;
  projectName: string;
}

/** SonarQube-specific types */
export interface SonarQubeIssue {
  key: string;
  rule: string;
  severity: "BLOCKER" | "CRITICAL" | "MAJOR" | "MINOR" | "INFO";
  component: string;
  project: string;
  line?: number;
  message: string;
  type: "BUG" | "VULNERABILITY" | "CODE_SMELL" | "SECURITY_HOTSPOT";
  status: "OPEN" | "CONFIRMED" | "REOPENED" | "RESOLVED" | "CLOSED";
  resolution?: string;
  debt?: string;
  tags: string[];
  creationDate: string;
  updateDate: string;
}

export interface SonarQubeSearchResult {
  total: number;
  p: number;
  ps: number;
  paging: { pageIndex: number; pageSize: number; total: number };
  issues: SonarQubeIssue[];
}

/** OWASP ZAP-specific types */
export interface ZapAlert {
  alert: string;
  name: string;
  riskcode: string;
  confidence: string;
  riskdesc: string;
  desc: string;
  solution: string;
  reference: string;
  cweid: string;
  wascid: string;
  sourceid: string;
  instances: {
    uri: string;
    method: string;
    param?: string;
    evidence?: string;
  }[];
}

export interface ZapScanResult {
  site: {
    name: string;
    host: string;
    port: string;
    ssl: string;
    alerts: ZapAlert[];
  }[];
}
