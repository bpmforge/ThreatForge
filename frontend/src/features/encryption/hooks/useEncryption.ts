"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiGet, apiPost, apiDelete } from "@/lib/api-client";
import type {
  EncryptionConfig,
  RegisterKeyParams,
  RegisterKeyResult,
  RotateKeyParams,
  RotateKeyResult,
} from "../types";

async function fetchEncryptionConfig(orgId: string): Promise<EncryptionConfig> {
  return apiGet<EncryptionConfig>(`/api/organizations/${orgId}/encryption`);
}

async function registerKey(
  orgId: string,
  params: RegisterKeyParams,
): Promise<RegisterKeyResult> {
  return apiPost<RegisterKeyResult>(
    `/api/organizations/${orgId}/encryption/keys`,
    params,
  );
}

async function rotateKey(
  orgId: string,
  params: RotateKeyParams,
): Promise<RotateKeyResult> {
  return apiPost<RotateKeyResult>(
    `/api/organizations/${orgId}/encryption/rotate`,
    params,
  );
}

async function revokeKey(orgId: string, version: number): Promise<void> {
  await apiDelete(`/api/organizations/${orgId}/encryption/keys/${version}`);
}

async function disableBYOK(orgId: string): Promise<void> {
  await apiPost(`/api/organizations/${orgId}/encryption/disable`);
}

async function verifyKey(
  orgId: string,
  key: string,
  version?: number,
): Promise<boolean> {
  try {
    const data = await apiPost<{ valid: boolean }>(
      `/api/organizations/${orgId}/encryption/verify`,
      { key, version },
    );
    return data.valid;
  } catch (error) {
    // A non-2xx response means the key could not be verified
    if (error instanceof ApiError) return false;
    throw error;
  }
}

export function useEncryptionConfig(orgId: string | undefined) {
  return useQuery({
    queryKey: ["encryption", orgId],
    queryFn: () => fetchEncryptionConfig(orgId!),
    enabled: !!orgId,
  });
}

export function useEncryptionMutations(orgId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["encryption", orgId] });
    queryClient.invalidateQueries({ queryKey: ["encryption-keys", orgId] });
  };

  const registerKeyMutation = useMutation({
    mutationFn: (params: RegisterKeyParams) => registerKey(orgId, params),
    onSuccess: invalidate,
  });

  const rotateKeyMutation = useMutation({
    mutationFn: (params: RotateKeyParams) => rotateKey(orgId, params),
    onSuccess: invalidate,
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (version: number) => revokeKey(orgId, version),
    onSuccess: invalidate,
  });

  const disableBYOKMutation = useMutation({
    mutationFn: () => disableBYOK(orgId),
    onSuccess: invalidate,
  });

  const verifyKeyMutation = useMutation({
    mutationFn: ({ key, version }: { key: string; version?: number }) =>
      verifyKey(orgId, key, version),
  });

  return {
    registerKey: registerKeyMutation.mutate,
    registerKeyAsync: registerKeyMutation.mutateAsync,
    isRegistering: registerKeyMutation.isPending,
    rotateKey: rotateKeyMutation.mutate,
    rotateKeyAsync: rotateKeyMutation.mutateAsync,
    isRotating: rotateKeyMutation.isPending,
    revokeKey: revokeKeyMutation.mutate,
    isRevoking: revokeKeyMutation.isPending,
    disableBYOK: disableBYOKMutation.mutate,
    isDisabling: disableBYOKMutation.isPending,
    verifyKey: verifyKeyMutation.mutateAsync,
    isVerifying: verifyKeyMutation.isPending,
  };
}
