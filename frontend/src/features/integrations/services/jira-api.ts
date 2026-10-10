import { apiPost, apiPut } from "@/lib/api-client";
import type {
  IntegrationDetail,
  JiraProject,
  JiraIssueType,
  JiraConfig,
  JiraCredentials,
} from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export async function testJiraConnection(
  orgId: string,
  data: { baseUrl: string; email: string; apiToken: string },
): Promise<{
  success: boolean;
  serverInfo?: { version: string; serverTitle: string };
}> {
  return apiPost(
    `${API_BASE}/api/v1/organizations/${orgId}/integrations/jira/test`,
    data,
  );
}

export async function fetchJiraProjects(
  orgId: string,
  data: { baseUrl: string; email: string; apiToken: string },
): Promise<JiraProject[]> {
  return apiPost(
    `${API_BASE}/api/v1/organizations/${orgId}/integrations/jira/projects`,
    data,
  );
}

export async function fetchJiraIssueTypes(
  orgId: string,
  data: {
    baseUrl: string;
    email: string;
    apiToken: string;
    projectKey: string;
  },
): Promise<JiraIssueType[]> {
  return apiPost(
    `${API_BASE}/api/v1/organizations/${orgId}/integrations/jira/issue-types`,
    data,
  );
}

export async function createJiraIntegration(
  orgId: string,
  data: { name: string; config: JiraConfig; credentials: JiraCredentials },
): Promise<IntegrationDetail> {
  return apiPost(
    `${API_BASE}/api/v1/organizations/${orgId}/integrations/jira`,
    data,
  );
}

export async function updateJiraIntegration(
  orgId: string,
  integrationId: string,
  data: {
    name?: string;
    config?: Partial<JiraConfig>;
    credentials?: JiraCredentials;
    status?: "ACTIVE" | "INACTIVE";
  },
): Promise<IntegrationDetail> {
  const response = await apiPut<{ data: IntegrationDetail }>(
    `${API_BASE}/api/v1/organizations/${orgId}/integrations/${integrationId}`,
    data,
  );
  return response.data;
}

export async function createJiraIssue(
  orgId: string,
  integrationId: string,
  data: { threatId?: string; mitigationId?: string },
): Promise<{ success: boolean; issueKey: string; issueUrl: string }> {
  return apiPost(
    `${API_BASE}/api/v1/organizations/${orgId}/integrations/${integrationId}/jira/issues`,
    data,
  );
}
