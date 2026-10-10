/**
 * TanStack Query hooks for Admin Settings
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getSystemSettings,
  updateSystemSettings,
  type SystemSettings,
} from "@/features/admin/services/api";

const QUERY_KEYS = {
  settings: ["adminSettings"] as const,
};

export function useSystemSettings() {
  return useQuery({
    queryKey: QUERY_KEYS.settings,
    queryFn: getSystemSettings,
  });
}

export function useUpdateSystemSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<SystemSettings>) => updateSystemSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.settings });
      toast.success("Settings saved successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to save settings", {
        description: error.message,
      });
    },
  });
}
