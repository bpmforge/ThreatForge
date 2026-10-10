/**
 * Marketplace hooks using TanStack Query
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../services/api";
import type { MarketplaceSort } from "../services/api";

const MARKETPLACE_QUERY_KEYS = {
  libraries: (search?: string, sort?: string, featured?: boolean) =>
    ["marketplace", "libraries", search, sort, featured] as const,
  library: (id: string) => ["marketplace", "library", id] as const,
  subscriptions: (orgId: string) =>
    ["marketplace", "subscriptions", orgId] as const,
  categories: (search?: string) =>
    ["marketplace", "categories", search] as const,
  templates: (search?: string, sort?: string) =>
    ["marketplace", "templates", search, sort] as const,
  stats: () => ["marketplace", "stats"] as const,
};

// Browse public libraries
export function usePublicLibraries(options?: {
  search?: string;
  limit?: number;
  sort?: MarketplaceSort;
  featured?: boolean;
}) {
  const { search, limit = 20, sort = "newest", featured } = options ?? {};
  return useQuery({
    queryKey: MARKETPLACE_QUERY_KEYS.libraries(search, sort, featured),
    queryFn: () => api.fetchPublicLibraries({ search, limit, sort, featured }),
  });
}

// Organization's subscriptions
export function useSubscriptions(orgId: string | null | undefined) {
  return useQuery({
    queryKey: MARKETPLACE_QUERY_KEYS.subscriptions(orgId!),
    queryFn: () => api.fetchSubscriptions(orgId!),
    enabled: !!orgId,
  });
}

// Subscribe to a library
export function useSubscribeToLibrary(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (libraryId: string) => api.subscribeToLibrary(orgId, libraryId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: MARKETPLACE_QUERY_KEYS.subscriptions(orgId),
      });
      // Also invalidate library counts
      queryClient.invalidateQueries({
        queryKey: ["marketplace", "libraries"],
      });
    },
  });
}

// Unsubscribe from a library
export function useUnsubscribeFromLibrary(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (subscriptionId: string) =>
      api.unsubscribeFromLibrary(orgId, subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: MARKETPLACE_QUERY_KEYS.subscriptions(orgId),
      });
      queryClient.invalidateQueries({
        queryKey: ["marketplace", "libraries"],
      });
    },
  });
}

// Browse public categories
export function usePublicCategories(search?: string) {
  return useQuery({
    queryKey: MARKETPLACE_QUERY_KEYS.categories(search),
    queryFn: () => api.fetchPublicCategories({ search }),
  });
}

// Browse public templates
export function usePublicTemplates(options?: {
  search?: string;
  sort?: MarketplaceSort;
}) {
  const { search, sort = "newest" } = options ?? {};
  return useQuery({
    queryKey: MARKETPLACE_QUERY_KEYS.templates(search, sort),
    queryFn: () => api.fetchPublicTemplates({ search, sort }),
  });
}

// Marketplace stats
export function useMarketplaceStats() {
  return useQuery({
    queryKey: MARKETPLACE_QUERY_KEYS.stats(),
    queryFn: () => api.fetchMarketplaceStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
