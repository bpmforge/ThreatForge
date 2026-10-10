/**
 * TanStack Query hooks for Two-Factor Authentication
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api-client";

export interface TwoFactorStatus {
  enabled: boolean;
  verifiedAt: string | null;
  backupCodesRemaining: number;
}

export interface SetupData {
  qrCode: string;
  secret: string;
  backupCodes: string[];
}

interface EnableRequest {
  code: string;
}

interface DisableRequest {
  code: string;
  password?: string;
}

interface RegenerateRequest {
  code: string;
}

interface RegenerateResponse {
  backupCodes: string[];
}

const QUERY_KEYS = {
  status: ["twoFactorStatus"] as const,
};

export function useTwoFactorStatus() {
  return useQuery({
    queryKey: QUERY_KEYS.status,
    queryFn: () => apiGet<TwoFactorStatus>(`/api/users/me/two-factor`),
  });
}

export function useStartSetup() {
  return useMutation({
    mutationFn: () => apiPost<SetupData>(`/api/users/me/two-factor/setup`),
    onError: (error: Error) => {
      toast.error("Setup failed", { description: error.message });
    },
  });
}

export function useEnableTwoFactor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: EnableRequest) =>
      apiPost<void>(`/api/users/me/two-factor/enable`, data),
    onSuccess: () => {
      toast.success("2FA enabled successfully");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.status });
    },
    onError: (error: Error) => {
      toast.error("Verification failed", { description: error.message });
    },
  });
}

export function useDisableTwoFactor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DisableRequest) =>
      apiPost<void>(`/api/users/me/two-factor/disable`, data),
    onSuccess: () => {
      toast.success("2FA disabled successfully");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.status });
    },
    onError: (error: Error) => {
      toast.error("Failed to disable", { description: error.message });
    },
  });
}

export function useRegenerateBackupCodes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RegenerateRequest) =>
      apiPost<RegenerateResponse>(
        `/api/users/me/two-factor/backup-codes`,
        data,
      ),
    onSuccess: () => {
      toast.success("Backup codes regenerated");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.status });
    },
    onError: (error: Error) => {
      toast.error("Failed to regenerate", { description: error.message });
    },
  });
}
