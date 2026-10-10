/**
 * TanStack Query hooks for API Token Management
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";

export interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  usageCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  revokedAt: string | null;
}

export interface Scope {
  value: string;
  label: string;
  category: string;
}

interface CreateTokenRequest {
  name: string;
  scopes: string[];
  expiresAt?: string;
}

interface CreateTokenResponse {
  token: string;
  apiToken: ApiToken;
}

const QUERY_KEYS = {
  tokens: ["apiTokens"] as const,
  scopes: ["apiTokenScopes"] as const,
};

export function useApiTokens() {
  return useQuery({
    queryKey: QUERY_KEYS.tokens,
    queryFn: () => apiGet<ApiToken[]>(`/api/users/me/api-tokens`),
  });
}

export function useApiTokenScopes() {
  return useQuery({
    queryKey: QUERY_KEYS.scopes,
    queryFn: async () => {
      const data = await apiGet<{ scopes: Scope[] }>(
        `/api/users/me/api-tokens/scopes`,
      );
      return data.scopes;
    },
  });
}

export function useCreateApiToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTokenRequest) =>
      apiPost<CreateTokenResponse>(`/api/users/me/api-tokens`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tokens });
    },
    onError: (error: Error) => {
      toast.error("Failed to create token", { description: error.message });
    },
  });
}

export function useDeleteApiToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tokenId: string) =>
      apiDelete<void>(`/api/users/me/api-tokens/${tokenId}`),
    onSuccess: () => {
      toast.success("Token deleted");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tokens });
    },
    onError: (error: Error) => {
      toast.error("Failed to delete token", { description: error.message });
    },
  });
}
