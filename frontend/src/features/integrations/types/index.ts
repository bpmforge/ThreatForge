/**
 * Integration feature types
 */

export type IntegrationType =
  | "JIRA"
  | "GITHUB_ISSUES"
  | "AZURE_DEVOPS"
  | "LINEAR"
  | "ASANA"
  | "SLACK"
  | "TEAMS"
  | "CUSTOM_WEBHOOK";

export type IntegrationStatus = "INACTIVE" | "ACTIVE" | "ERROR" | "SUSPENDED";

export interface Integration {
  id: string;
  type: IntegrationType;
  name: string;
  status: IntegrationStatus;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  syncErrors: number;
  mappingCount: number;
  syncLogCount: number;
  createdBy: { name: string | null; email: string };
  createdAt: string;
}

export interface IntegrationDetail extends Integration {
  config: Record<string, unknown>;
  scopes: string[];
  consecutiveFailures: number;
  updatedAt: string;
}

export interface IntegrationTypeInfo {
  type: IntegrationType;
  name: string;
  description: string;
  icon: string;
  features: string[];
  authType: "oauth2" | "api_key";
  status: IntegrationStatus | null;
  isConfigured: boolean;
}

// JIRA-specific types
export interface JiraConfig {
  baseUrl: string;
  projectKey: string;
  issueTypeIdThreat?: string;
  issueTypeIdMitigation?: string;
  priorityMapping?: Record<string, string>;
  statusMapping?: Record<string, string>;
  autoCreateIssues?: boolean;
  syncDirection?: "PUSH_ONLY" | "PULL_ONLY" | "BIDIRECTIONAL";
}

export interface JiraCredentials {
  type: "api_token";
  email: string;
  apiToken: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  description: string;
  subtask: boolean;
}

export interface IntegrationMapping {
  id: string;
  localType: string;
  localId: string;
  externalType: string;
  externalId: string;
  externalUrl: string | null;
  externalKey: string | null;
  syncDirection: string;
  lastSyncedAt: string | null;
  createdAt: string;
}

// GitHub-specific types
export interface GitHubConfig {
  owner: string;
  repo: string;
  labelForThreats?: string;
  labelForMitigations?: string;
  autoCreateIssues?: boolean;
  syncDirection?: "PUSH_ONLY" | "PULL_ONLY" | "BIDIRECTIONAL";
  issueTemplate?: string;
}

export interface GitHubCredentials {
  type: "personal_access_token" | "github_app";
  token: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
}

export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
}
