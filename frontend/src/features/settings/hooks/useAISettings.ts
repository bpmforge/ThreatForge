/**
 * Hook for managing AI settings.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AISettings } from "../types";
import { DEFAULT_AI_SETTINGS } from "../types";
import * as api from "../services/api";

interface UseAISettingsOptions {
  orgId: string | null;
}

const QUERY_KEYS = {
  settings: (orgId: string) => ["aiSettings", orgId] as const,
  status: (orgId: string) => ["aiStatus", orgId] as const,
};

export function useAISettings({ orgId }: UseAISettingsOptions) {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: QUERY_KEYS.settings(orgId!),
    queryFn: () => api.fetchAISettings(orgId!),
    enabled: !!orgId,
  });

  const statusQuery = useQuery({
    queryKey: QUERY_KEYS.status(orgId!),
    queryFn: () => api.fetchAIStatus(orgId!),
    enabled: !!orgId,
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<AISettings>) =>
      api.updateAISettings(orgId!, updates),
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(QUERY_KEYS.settings(orgId!), updatedSettings);
      // Refresh status after settings change
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.status(orgId!) });
    },
    onError: () => {
      toast.error("Failed to save AI settings");
    },
  });

  const settings = settingsQuery.data ?? DEFAULT_AI_SETTINGS;
  const status = statusQuery.data ?? null;
  const loading = settingsQuery.isLoading || statusQuery.isLoading;
  const saving = updateMutation.isPending;
  const error =
    settingsQuery.error?.message ?? statusQuery.error?.message ?? null;

  const updateSettings = (updates: Partial<AISettings>) => {
    if (!orgId) return;
    updateMutation.mutate(updates);
  };

  const toggleEnabled = () => {
    updateSettings({ enabled: !settings.enabled });
  };

  const refetch = () => {
    settingsQuery.refetch();
    statusQuery.refetch();
  };

  return {
    settings,
    status,
    loading,
    saving,
    error,
    updateSettings,
    toggleEnabled,
    refetch,
  };
}
