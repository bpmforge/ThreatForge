"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../services/api";

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"] as const,
    queryFn: api.getAdminStats,
    staleTime: 60 * 1000,
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ["admin", "health"] as const,
    queryFn: api.getSystemHealth,
    refetchInterval: 30 * 1000,
  });
}

export function useAuditLog(params?: {
  entityType?: string;
  action?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["admin", "audit", params] as const,
    queryFn: () => api.getAuditLog(params),
  });
}

export function useCacheStats() {
  return useQuery({
    queryKey: ["admin", "cache", "stats"] as const,
    queryFn: api.getCacheStats,
    refetchInterval: 30 * 1000,
  });
}

export function useClearCache() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.clearCache,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "cache"] }),
  });
}

export function useInvalidateCacheByTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.invalidateCacheByTag,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "cache"] }),
  });
}

export function useInvalidateCacheByPattern() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.invalidateCacheByPattern,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "cache"] }),
  });
}

export function useSystemInfo() {
  return useQuery({
    queryKey: ["admin", "system", "info"] as const,
    queryFn: api.getSystemInfo,
    refetchInterval: 60 * 1000,
  });
}

export function useTraces(limit?: number) {
  return useQuery({
    queryKey: ["admin", "traces", { limit }] as const,
    queryFn: () => api.getTraces(limit),
    refetchInterval: 30 * 1000,
  });
}

export function useTrace(traceId: string) {
  return useQuery({
    queryKey: ["admin", "traces", traceId] as const,
    queryFn: () => api.getTrace(traceId),
    enabled: !!traceId,
  });
}
