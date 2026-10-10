"use client";

/**
 * TanStack Query hooks for AI-generated attack chains (A11).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "../services/api";
import type { AttackChainWithHops, ChainStatus } from "../types";

// =============================================================================
// Query Keys
// =============================================================================

export const ATTACK_CHAIN_QUERY_KEYS = {
  chains: (modelId: string) => ["attack-chains", modelId] as const,
  chain: (modelId: string, chainId: string) =>
    ["attack-chains", modelId, chainId] as const,
};

// =============================================================================
// Query Hooks
// =============================================================================

/** Fetch all attack chains for a model. */
export function useAttackChains(modelId: string | null | undefined) {
  return useQuery({
    queryKey: ATTACK_CHAIN_QUERY_KEYS.chains(modelId ?? ""),
    queryFn: () => {
      if (!modelId) throw new Error("Model ID is required");
      return api.listAttackChains(modelId);
    },
    enabled: !!modelId,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/** Update the status of an attack chain. */
export function useUpdateAttackChainStatus(modelId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      chainId,
      status,
    }: {
      chainId: string;
      status: ChainStatus;
    }) => {
      if (!modelId) throw new Error("Model ID is required");
      return api.updateAttackChainStatus(modelId, chainId, status);
    },
    onSuccess: (updated) => {
      if (!modelId) return;
      queryClient.setQueryData<AttackChainWithHops[]>(
        ATTACK_CHAIN_QUERY_KEYS.chains(modelId),
        (old) =>
          old?.map((c) => (c.id === updated.id ? updated : c)) ?? [updated],
      );
      toast.success("Chain status updated");
    },
    onError: () => {
      toast.error("Failed to update chain status");
    },
  });
}
