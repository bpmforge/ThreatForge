import { apiDelete, apiGet, apiPost } from "@/lib/api-client";

interface ScimConfig {
  enabled: boolean;
  token: {
    id: string;
    prefix: string;
    description: string | null;
    lastUsedAt: string | null;
    createdAt: string;
  } | null;
  endpoints: {
    base: string;
    users: string;
    groups: string;
    serviceProviderConfig: string;
  };
}

export type { ScimConfig };

export function fetchScimConfig(orgId: string): Promise<ScimConfig> {
  return apiGet<ScimConfig>(`/api/organizations/${orgId}/scim`);
}

export function rotateScimToken(
  orgId: string,
): Promise<{ token: string; prefix: string }> {
  return apiPost<{ token: string; prefix: string }>(
    `/api/organizations/${orgId}/scim/rotate`,
    {},
  );
}

export async function revokeScimToken(orgId: string): Promise<void> {
  await apiDelete<void>(`/api/organizations/${orgId}/scim/token`);
}
