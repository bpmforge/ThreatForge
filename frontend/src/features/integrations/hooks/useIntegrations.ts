/**
 * Integration hooks using TanStack Query
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../services/api";
import type { JiraConfig, JiraCredentials } from "../types";

const INTEGRATION_QUERY_KEYS = {
  integrations: (orgId: string) => ["integrations", orgId] as const,
  integration: (orgId: string, integrationId: string) =>
    ["integrations", orgId, integrationId] as const,
  types: (orgId: string) => ["integrations", orgId, "types"] as const,
  mappings: (orgId: string, integrationId: string) =>
    ["integrations", orgId, integrationId, "mappings"] as const,
  syncLogs: (orgId: string, integrationId: string) =>
    ["integrations", orgId, integrationId, "sync-logs"] as const,
};

// List all integrations for an org
export function useIntegrations(orgId: string | null | undefined) {
  return useQuery({
    queryKey: INTEGRATION_QUERY_KEYS.integrations(orgId!),
    queryFn: () => api.fetchIntegrations(orgId!),
    enabled: !!orgId,
  });
}

// Get single integration detail
export function useIntegration(
  orgId: string | null | undefined,
  integrationId: string | null,
) {
  return useQuery({
    queryKey: INTEGRATION_QUERY_KEYS.integration(orgId!, integrationId!),
    queryFn: () => api.fetchIntegration(orgId!, integrationId!),
    enabled: !!orgId && !!integrationId,
  });
}

// Get available integration types
export function useIntegrationTypes(orgId: string | null | undefined) {
  return useQuery({
    queryKey: INTEGRATION_QUERY_KEYS.types(orgId!),
    queryFn: () => api.fetchIntegrationTypes(orgId!),
    enabled: !!orgId,
  });
}

// Get integration mappings
export function useIntegrationMappings(
  orgId: string | null | undefined,
  integrationId: string | null,
) {
  return useQuery({
    queryKey: INTEGRATION_QUERY_KEYS.mappings(orgId!, integrationId!),
    queryFn: () => api.fetchMappings(orgId!, integrationId!),
    enabled: !!orgId && !!integrationId,
  });
}

// Delete integration
export function useDeleteIntegration(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (integrationId: string) =>
      api.deleteIntegration(orgId, integrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: INTEGRATION_QUERY_KEYS.integrations(orgId),
      });
    },
  });
}

// Trigger sync
export function useTriggerSync(orgId: string, integrationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.triggerSync(orgId, integrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: INTEGRATION_QUERY_KEYS.syncLogs(orgId, integrationId),
      });
      queryClient.invalidateQueries({
        queryKey: INTEGRATION_QUERY_KEYS.integration(orgId, integrationId),
      });
    },
  });
}

// JIRA-specific hooks
export function useTestJiraConnection(orgId: string) {
  return useMutation({
    mutationFn: (data: { baseUrl: string; email: string; apiToken: string }) =>
      api.testJiraConnection(orgId, data),
  });
}

export function useFetchJiraProjects(orgId: string) {
  return useMutation({
    mutationFn: (data: { baseUrl: string; email: string; apiToken: string }) =>
      api.fetchJiraProjects(orgId, data),
  });
}

export function useFetchJiraIssueTypes(orgId: string) {
  return useMutation({
    mutationFn: (data: {
      baseUrl: string;
      email: string;
      apiToken: string;
      projectKey: string;
    }) => api.fetchJiraIssueTypes(orgId, data),
  });
}

export function useCreateJiraIntegration(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      config: JiraConfig;
      credentials: JiraCredentials;
    }) => api.createJiraIntegration(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: INTEGRATION_QUERY_KEYS.integrations(orgId),
      });
      queryClient.invalidateQueries({
        queryKey: INTEGRATION_QUERY_KEYS.types(orgId),
      });
    },
  });
}

export function useUpdateJiraIntegration(orgId: string, integrationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name?: string;
      config?: Partial<JiraConfig>;
      credentials?: JiraCredentials;
      status?: "ACTIVE" | "INACTIVE";
    }) => api.updateJiraIntegration(orgId, integrationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: INTEGRATION_QUERY_KEYS.integrations(orgId),
      });
      queryClient.invalidateQueries({
        queryKey: INTEGRATION_QUERY_KEYS.integration(orgId, integrationId),
      });
    },
  });
}

export function useCreateJiraIssue(orgId: string, integrationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { threatId?: string; mitigationId?: string }) =>
      api.createJiraIssue(orgId, integrationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: INTEGRATION_QUERY_KEYS.mappings(orgId, integrationId),
      });
    },
  });
}
