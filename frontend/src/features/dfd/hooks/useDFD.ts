/**
 * DFD React Query hooks
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../services/api";
import { defaultMutationErrorHandler } from "@/lib/mutation-helpers";
import type { CreateDFDRequest, UpdateDFDRequest } from "../types";

const QUERY_KEYS = {
  dfds: (modelId: string) => ["dfds", modelId] as const,
  dfd: (modelId: string, dfdId: string) => ["dfd", modelId, dfdId] as const,
};

// =============================================================================
// DFD Hooks
// =============================================================================

export function useDFDs(threatModelId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.dfds(threatModelId!),
    queryFn: () => api.getDFDs(threatModelId!),
    enabled: !!threatModelId,
  });
}

export function useDFD(
  threatModelId: string | undefined,
  dfdId: string | undefined,
) {
  return useQuery({
    queryKey: QUERY_KEYS.dfd(threatModelId!, dfdId!),
    queryFn: () => api.getDFD(threatModelId!, dfdId!),
    enabled: !!threatModelId && !!dfdId,
  });
}

export function useCreateDFD(threatModelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDFDRequest) => api.createDFD(threatModelId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.dfds(threatModelId),
      });
    },
    onError: (error) => defaultMutationErrorHandler(error, "CreateDFD"),
  });
}

export function useUpdateDFD(threatModelId: string, dfdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateDFDRequest) =>
      api.updateDFD(threatModelId, dfdId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.dfd(threatModelId, dfdId), updated);
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.dfds(threatModelId),
      });
    },
    onError: (error) => defaultMutationErrorHandler(error, "UpdateDFD"),
  });
}

export function useDeleteDFD(threatModelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dfdId: string) => api.deleteDFD(threatModelId, dfdId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.dfds(threatModelId),
      });
    },
    onError: (error) => defaultMutationErrorHandler(error, "DeleteDFD"),
  });
}
