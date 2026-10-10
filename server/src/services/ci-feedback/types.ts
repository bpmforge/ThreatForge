/**
 * CI/CD Feedback Types
 *
 * Types for PR comments and status updates.
 */

/** Supported CI providers */
export type CIProvider = "GITHUB" | "GITLAB" | "BITBUCKET" | "AZURE_DEVOPS";

/** Severity levels */
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

/** Finding from a scan */
export interface Finding {
  threatId: string;
  name: string;
  description: string | null;
  severity: Severity;
  status: string;
  strideCategories: string[];
  componentName?: string;
  connectionLabel?: string;
}

/** Scan result summary */
export interface ScanSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  open: number;
  mitigated: number;
}

/** Check run status */
type CheckStatus = "queued" | "in_progress" | "completed";
export type CheckConclusion =
  | "success"
  | "failure"
  | "neutral"
  | "cancelled"
  | "skipped"
  | "timed_out"
  | "action_required";

/** GitHub check run request */
export interface CreateCheckRunRequest {
  owner: string;
  repo: string;
  name: string;
  headSha: string;
  status: CheckStatus;
  conclusion?: CheckConclusion;
  title?: string;
  summary?: string;
  text?: string;
  annotations?: CheckAnnotation[];
}

/** GitHub check annotation */
interface CheckAnnotation {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: "notice" | "warning" | "failure";
  message: string;
  title?: string;
}

/** PR comment request */
export interface CreatePRCommentRequest {
  owner: string;
  repo: string;
  prNumber: number;
  body: string;
}

/** GitHub client config */
export interface GitHubClientConfig {
  token: string;
  baseUrl?: string; // For GitHub Enterprise
}

/** Diff analysis result */
export interface DiffAnalysis {
  /** Files that were changed */
  changedFiles: string[];
  /** New threats since base branch */
  newThreats: Finding[];
  /** Resolved threats since base branch */
  resolvedThreats: Finding[];
  /** Changed threats */
  changedThreats: Finding[];
}
