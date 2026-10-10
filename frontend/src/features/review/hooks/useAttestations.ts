"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";

export interface Attestation {
  id: string;
  threatModelId: string;
  userId: string;
  releaseRef: string | null;
  summary: string | null;
  attestedAt: string;
  attestedBy?: { id: string; name: string | null; email: string | null };
}

function fetchAttestations(modelId: string): Promise<Attestation[]> {
  return apiGet<Attestation[]>(`/api/threat-models/${modelId}/attestations`);
}

export function useAttestations(modelId: string) {
  return useQuery({
    queryKey: ["attestations", modelId],
    queryFn: () => fetchAttestations(modelId),
    enabled: !!modelId,
  });
}

export function useCreateAttestation(modelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { releaseRef?: string; summary?: string }) =>
      apiPost<Attestation>(`/api/threat-models/${modelId}/attestations`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attestations", modelId] });
    },
  });
}
