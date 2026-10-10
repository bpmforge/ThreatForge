/**
 * useAIProviders - React Query hooks for AI provider management.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import type { AIProviderConfig, AIProviderInput } from "../types";

// API functions

async function fetchProviders(
  orgId: string,
): Promise<{ providers: AIProviderConfig[] }> {
  return apiGet<{ providers: AIProviderConfig[] }>(
    `/api/organizations/${orgId}/ai-providers`,
  );
}

async function createProvider(
  orgId: string,
  data: AIProviderInput,
): Promise<{ provider: AIProviderConfig }> {
  return apiPost<{ provider: AIProviderConfig }>(
    `/api/organizations/${orgId}/ai-providers`,
    data,
  );
}

async function updateProvider(
  orgId: string,
  providerId: string,
  data: Partial<AIProviderInput>,
): Promise<{ provider: AIProviderConfig }> {
  return apiPut<{ provider: AIProviderConfig }>(
    `/api/organizations/${orgId}/ai-providers/${providerId}`,
    data,
  );
}

async function deleteProvider(
  orgId: string,
  providerId: string,
): Promise<void> {
  await apiDelete(`/api/organizations/${orgId}/ai-providers/${providerId}`);
}

async function testProvider(
  orgId: string,
  providerId: string,
): Promise<{ success: boolean; error?: string; latencyMs?: number }> {
  return apiPost<{ success: boolean; error?: string; latencyMs?: number }>(
    `/api/organizations/${orgId}/ai-providers/${providerId}/test`,
  );
}

async function reorderProviders(
  orgId: string,
  providerIds: string[],
): Promise<void> {
  await apiPut(`/api/organizations/${orgId}/ai-providers/reorder`, {
    providerIds,
  });
}

// Query keys
const queryKeys = {
  providers: (orgId: string) => ["ai-providers", orgId] as const,
  usage: (orgId: string) => ["ai-providers-usage", orgId] as const,
};

// Hooks
export function useAIProviders(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.providers(orgId || ""),
    queryFn: () => fetchProviders(orgId!),
    enabled: Boolean(orgId),
    select: (data) => data.providers,
  });
}

export function useCreateAIProvider(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AIProviderInput) => createProvider(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.providers(orgId) });
    },
  });
}

export function useUpdateAIProvider(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      providerId,
      data,
    }: {
      providerId: string;
      data: Partial<AIProviderInput>;
    }) => updateProvider(orgId, providerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.providers(orgId) });
    },
  });
}

export function useDeleteAIProvider(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (providerId: string) => deleteProvider(orgId, providerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.providers(orgId) });
    },
  });
}

export function useTestAIProvider(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (providerId: string) => testProvider(orgId, providerId),
    onSuccess: () => {
      // Refresh providers to get updated test status
      queryClient.invalidateQueries({ queryKey: queryKeys.providers(orgId) });
    },
  });
}

export function useReorderAIProviders(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (providerIds: string[]) => reorderProviders(orgId, providerIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.providers(orgId) });
    },
  });
}
