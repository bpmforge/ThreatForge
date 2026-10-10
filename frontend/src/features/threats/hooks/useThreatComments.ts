"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "../services/api";
import type { ThreatComment } from "../types";
import { THREAT_QUERY_KEYS } from "./useThreats";

export function useThreatComments(
  modelId: string | null | undefined,
  threatId: string | null | undefined,
) {
  return useQuery<ThreatComment[]>({
    queryKey: THREAT_QUERY_KEYS.comments(modelId || "", threatId || ""),
    queryFn: () => {
      if (!modelId || !threatId) throw new Error("IDs required");
      return api.fetchThreatComments(modelId, threatId);
    },
    enabled: !!modelId && !!threatId,
  });
}

export function useCreateThreatComment(
  modelId: string | null | undefined,
  threatId: string | null | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => {
      if (!modelId || !threatId) throw new Error("IDs required");
      return api.createThreatComment(modelId, threatId, body);
    },
    onSuccess: (newComment) => {
      if (!modelId || !threatId) return;
      queryClient.setQueryData<ThreatComment[]>(
        THREAT_QUERY_KEYS.comments(modelId, threatId),
        (old) => (old ? [...old, newComment] : [newComment]),
      );
    },
    onError: () => {
      toast.error("Failed to post comment");
    },
  });
}

export function useDeleteThreatComment(
  modelId: string | null | undefined,
  threatId: string | null | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => {
      if (!modelId || !threatId) throw new Error("IDs required");
      return api.deleteThreatComment(modelId, threatId, commentId);
    },
    onSuccess: (_, commentId) => {
      if (!modelId || !threatId) return;
      queryClient.setQueryData<ThreatComment[]>(
        THREAT_QUERY_KEYS.comments(modelId, threatId),
        (old) => old?.filter((c) => c.id !== commentId),
      );
    },
    onError: () => {
      toast.error("Failed to delete comment");
    },
  });
}
