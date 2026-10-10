// Match backend types from server/src/services/security-scanners/types.ts

export type ScannerType =
  | "SNYK"
  | "SONARQUBE"
  | "CHECKMARX"
  | "VERACODE"
  | "OWASP_ZAP"
  | "BURP"
  | "CUSTOM";

export type FindingSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

type FindingCategory =
  | "VULNERABILITY"
  | "CODE_SMELL"
  | "BUG"
  | "SECURITY_HOTSPOT"
  | "LICENSE"
  | "DEPENDENCY"
  | "CONFIGURATION";

export type FindingStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "FIXED"
  | "DISMISSED"
  | "FALSE_POSITIVE";

export type MappingConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface ScannerFinding {
  id: string;
  externalId: string;
  scannerType: ScannerType;
  title: string;
  description: string;
  severity: FindingSeverity;
  category: FindingCategory;
  status: FindingStatus;
  cweIds: string[];
  cveIds: string[];
  owaspCategory?: string;
  filePath?: string;
  lineNumber?: number;
  codeSnippet?: string;
  componentName?: string;
  componentVersion?: string;
  fixAvailable?: boolean;
  fixVersion?: string;
  remediation?: string;
  externalUrl?: string;
  firstSeen: string;
  lastSeen: string;
  dismissedById?: string;
  dismissedAt?: string;
  dismissReason?: string;
  componentMappings?: FindingComponentMapping[];
}

interface FindingComponentMapping {
  id: string;
  findingId: string;
  componentId: string;
  confidence: MappingConfidence;
  mappingReason: string;
  verifiedById?: string;
  verifiedAt?: string;
  isCorrect?: boolean;
}

export interface ScanRun {
  id: string;
  scannerType: ScannerType;
  projectId: string;
  threatModelId?: string;
  startedAt: string;
  completedAt?: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  error?: string;
}

export interface FindingStats {
  total: number;
  bySeverity: Record<FindingSeverity, number>;
  byStatus: Record<FindingStatus, number>;
  byScanner: Record<ScannerType, number>;
  byCategory: Record<FindingCategory, number>;
}
