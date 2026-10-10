/**
 * Version history hooks
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import * as api from "../services/api";
import type { CreateVersionRequest } from "../types";

const QUERY_KEYS = {
  versions: (modelId: string) => ["versions", modelId] as const,
  version: (modelId: string, versionId: string) =>
    ["versions", modelId, versionId] as const,
};

/** Get version history for a threat model */
export function useVersionHistory(modelId: string | undefined | null) {
  return useQuery({
    queryKey: QUERY_KEYS.versions(modelId || ""),
    queryFn: () => {
      if (!modelId) throw new Error("Model ID is required");
      return api.getVersionHistory(modelId);
    },
    enabled: !!modelId,
  });
}

/** Get a specific version with full canvas state */
export function useVersion(
  modelId: string | undefined | null,
  versionId: string | undefined | null,
) {
  return useQuery({
    queryKey: QUERY_KEYS.version(modelId || "", versionId || ""),
    queryFn: () => {
      if (!modelId) throw new Error("Model ID is required");
      if (!versionId) throw new Error("Version ID is required");
      return api.getVersion(modelId, versionId);
    },
    enabled: !!modelId && !!versionId,
  });
}

/** Create a new version (snapshot current state) */
export function useCreateVersion(modelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVersionRequest | undefined = undefined) =>
      api.createVersion(modelId, data),
    onError: (err) =>
      toast.error(getErrorMessage(err, "Could not save the version")),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.versions(modelId) });
    },
  });
}

/** Restore a previous version */
export function useRestoreVersion(modelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (versionId: string) => api.restoreVersion(modelId, versionId),
    onError: (err) =>
      toast.error(getErrorMessage(err, "Could not restore the version")),
    onSuccess: () => {
      // Invalidate all queries that depend on the model state
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.versions(modelId) });
      queryClient.invalidateQueries({ queryKey: ["threat-model", modelId] });
      queryClient.invalidateQueries({ queryKey: ["threats", modelId] });
      // Also invalidate related derived data
      queryClient.invalidateQueries({ queryKey: ["attack-surface", modelId] });
      queryClient.invalidateQueries({ queryKey: ["report", modelId] });
    },
  });
}

/** Update version metadata */
export function useUpdateVersion(modelId: string, versionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name?: string; changesSummary?: string }) =>
      api.updateVersion(modelId, versionId, data),
    onError: (err) =>
      toast.error(getErrorMessage(err, "Could not update the version")),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.versions(modelId) });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.version(modelId, versionId),
      });
    },
  });
}
