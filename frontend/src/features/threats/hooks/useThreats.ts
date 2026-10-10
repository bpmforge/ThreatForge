"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "../services/api";
import type { Threat } from "../types";
import type { StrideCategory, Severity } from "@/types/canvas";

// =============================================================================
// Query Keys
// =============================================================================

export const THREAT_QUERY_KEYS = {
  threats: (modelId: string, sinceLastSignOff = false) =>
    sinceLastSignOff
      ? (["threats", modelId, "sinceLastSignOff"] as const)
      : (["threats", modelId] as const),
  threat: (modelId: string, threatId: string) =>
    ["threats", modelId, threatId] as const,
  comments: (modelId: string, threatId: string) =>
    ["threat-comments", modelId, threatId] as const,
};

// =============================================================================
// Query Hooks
// =============================================================================

export interface UseThreatsOptions {
  /** Filter to changes since the most recent attestation (#61 delta view). */
  sinceLastSignOff?: boolean;
}

export function useThreats(
  modelId: string | null | undefined,
  options: UseThreatsOptions = {},
) {
  const sinceLastSignOff = options.sinceLastSignOff ?? false;
  return useQuery({
    queryKey: THREAT_QUERY_KEYS.threats(modelId || "", sinceLastSignOff),
    queryFn: () => {
      if (!modelId) throw new Error("Model ID is required");
      return api.fetchThreats(modelId, { sinceLastSignOff });
    },
    enabled: !!modelId,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

interface CreateThreatData {
  name: string;
  description?: string;
  strideCategories: StrideCategory[];
  severity: Severity;
  category?: string;
  componentNodeId?: string;
  connectionEdgeId?: string;
}

export function useCreateThreat(modelId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateThreatData) => {
      if (!modelId) throw new Error("Model ID is required");
      return api.createThreat(modelId, data);
    },
    onSuccess: (newThreat) => {
      if (!modelId) return;
      queryClient.setQueryData<Threat[]>(
        THREAT_QUERY_KEYS.threats(modelId),
        (old) => (old ? [newThreat, ...old] : [newThreat]),
      );
    },
    onError: () => {
      toast.error("Failed to create threat");
    },
  });
}

export function useUpdateThreatStatus(modelId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      threatId,
      status,
    }: {
      threatId: string;
      status: string;
    }) => {
      if (!modelId) throw new Error("Model ID is required");
      return api.updateThreatStatus(modelId, threatId, status);
    },
    onSuccess: (updatedThreat) => {
      if (!modelId) return;
      queryClient.setQueryData<Threat[]>(
        THREAT_QUERY_KEYS.threats(modelId),
        (old) =>
          old?.map((t) => (t.id === updatedThreat.id ? updatedThreat : t)),
      );
    },
    onError: () => {
      toast.error("Failed to update threat status");
    },
  });
}

export function useUpdateThreat(modelId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      threatId,
      data,
    }: {
      threatId: string;
      data: {
        name?: string;
        description?: string;
        strideCategories?: StrideCategory[];
        severity?: Severity;
        status?: string;
        category?: string | null;
        assigneeId?: string | null;
      };
    }) => {
      if (!modelId) throw new Error("Model ID is required");
      return api.updateThreat(modelId, threatId, data);
    },
    onSuccess: (updatedThreat) => {
      if (!modelId) return;
      queryClient.setQueryData<Threat[]>(
        THREAT_QUERY_KEYS.threats(modelId),
        (old) =>
          old?.map((t) => (t.id === updatedThreat.id ? updatedThreat : t)),
      );
    },
    onError: () => {
      toast.error("Failed to update threat");
    },
  });
}

export function useResetThreatToAi(modelId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (threatId: string) => {
      if (!modelId) throw new Error("Model ID is required");
      return api.updateThreat(modelId, threatId, { manuallyEdited: false });
    },
    onSuccess: (updatedThreat) => {
      if (!modelId) return;
      queryClient.setQueryData<Threat[]>(
        THREAT_QUERY_KEYS.threats(modelId),
        (old) =>
          old?.map((t) => (t.id === updatedThreat.id ? updatedThreat : t)),
      );
    },
    onError: () => {
      toast.error("Failed to reset threat to AI");
    },
  });
}

export function useDeleteThreat(modelId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (threatId: string) => {
      if (!modelId) throw new Error("Model ID is required");
      return api.deleteThreat(modelId, threatId);
    },
    onSuccess: (_, threatId) => {
      if (!modelId) return;
      queryClient.setQueryData<Threat[]>(
        THREAT_QUERY_KEYS.threats(modelId),
        (old) => old?.filter((t) => t.id !== threatId),
      );
    },
    onError: () => {
      toast.error("Failed to delete threat");
    },
  });
}

// Re-export for backward compatibility
export * from "./useMitigations";
export * from "./useThreatComments";
