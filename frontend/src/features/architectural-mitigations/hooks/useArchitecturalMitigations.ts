"use client";

/**
 * Data + job hooks for architectural mitigations.
 * Analyze reuses useSubmitAiJob + JobProgressCard polling, like attack chains.
 */
import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPatch } from "@/lib/api-client";
import { useSubmitAiJob } from "@/features/ai-jobs";
import type {
  ArchitecturalMitigation,
  ArchitecturalMitigationPatch,
} from "../types";

const base = (modelId: string) =>
  `/api/threat-models/${modelId}/architectural-mitigations`;

const ARCH_MITIGATION_KEYS = {
  list: (modelId: string) => ["architectural-mitigations", modelId] as const,
};

export function useArchitecturalMitigations(modelId: string) {
  return useQuery({
    queryKey: ARCH_MITIGATION_KEYS.list(modelId),
    queryFn: () => apiGet<ArchitecturalMitigation[]>(base(modelId)),
    enabled: !!modelId,
  });
}

export function useUpdateArchitecturalMitigation(modelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: ArchitecturalMitigationPatch;
    }) => apiPatch<ArchitecturalMitigation>(`${base(modelId)}/${id}`, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData<ArchitecturalMitigation[]>(
        ARCH_MITIGATION_KEYS.list(modelId),
        (old) => old?.map((m) => (m.id === updated.id ? updated : m)) ?? [],
      );
    },
    onError: () => toast.error("Failed to update architectural mitigation"),
  });
}

export function useArchitecturalMitigationAnalysis(modelId: string) {
  const { submit } = useSubmitAiJob();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const analyze = useCallback(async () => {
    setIsStarting(true);
    setJobId(null);
    try {
      const res = await submit(`${base(modelId)}/analyze`, {}, { async: true });
      if (res.async && res.jobId) setJobId(res.jobId);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to start architectural analysis",
      );
    } finally {
      setIsStarting(false);
    }
  }, [modelId, submit]);

  const onJobComplete = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ARCH_MITIGATION_KEYS.list(modelId),
    });
    toast.success("Architectural mitigation analysis complete");
  }, [modelId, queryClient]);

  return {
    analyze,
    jobId,
    isStarting,
    onJobComplete,
    dismissJob: () => setJobId(null),
  };
}
