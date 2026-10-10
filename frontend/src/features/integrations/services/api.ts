/**
 * Integrations API service
 */
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import type {
  Integration,
  IntegrationDetail,
  IntegrationTypeInfo,
  IntegrationMapping,
} from "../types";

export * from "./jira-api";
export * from "./github-api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export async function fetchIntegrations(orgId: string): Promise<Integration[]> {
  const response = await apiGet<Integration[]>(
    `${API_BASE}/api/v1/organizations/${orgId}/integrations`,
  );
  return Array.isArray(response) ? response : [];
}

export async function fetchIntegration(
  orgId: string,
  integrationId: string,
): Promise<IntegrationDetail> {
  return apiGet(
    `${API_BASE}/api/v1/organizations/${orgId}/integrations/${integrationId}`,
  );
}

export async function fetchIntegrationTypes(
  orgId: string,
): Promise<IntegrationTypeInfo[]> {
  return apiGet(`${API_BASE}/api/v1/organizations/${orgId}/integrations/types`);
}

export async function deleteIntegration(
  orgId: string,
  integrationId: string,
): Promise<void> {
  await apiDelete(
    `${API_BASE}/api/v1/organizations/${orgId}/integrations/${integrationId}`,
  );
}

export async function fetchMappings(
  orgId: string,
  integrationId: string,
): Promise<IntegrationMapping[]> {
  return apiGet(
    `${API_BASE}/api/v1/organizations/${orgId}/integrations/${integrationId}/mappings`,
  );
}

export async function triggerSync(
  orgId: string,
  integrationId: string,
): Promise<{ success: boolean; message: string }> {
  return apiPost(
    `${API_BASE}/api/v1/organizations/${orgId}/integrations/${integrationId}/sync`,
    {},
  );
}
