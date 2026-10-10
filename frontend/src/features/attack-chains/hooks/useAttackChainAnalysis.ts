"use client";

/**
 * useAttackChainAnalysis
 *
 * Enqueues an ATTACK_CHAIN_ANALYSIS job via the standard ai-jobs submit hook
 * and tracks the returned jobId so the panel can show progress through the
 * standard JobProgressCard / useJobStatus polling pipeline. On completion it
 * invalidates the chains query so the new chains appear.
 */
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSubmitAiJob, aiJobErrorMessage } from "@/features/ai-jobs";
import { toast } from "sonner";
import { ATTACK_CHAIN_QUERY_KEYS } from "@/features/attack-paths";

export function useAttackChainAnalysis(modelId: string | null | undefined) {
  const { submit } = useSubmitAiJob();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const analyze = useCallback(async () => {
    if (!modelId) return;
    setIsStarting(true);
    setJobId(null);
    try {
      const res = await submit(
        `/api/threat-models/${modelId}/attack-chains/analyze`,
        {},
        { async: true },
      );
      if (res.async && res.jobId) {
        setJobId(res.jobId);
        toast.info("Attack chain analysis started", {
          description: "Detecting attack paths in the background.",
        });
      }
    } catch (err) {
      toast.error(
        aiJobErrorMessage(err, "Failed to start attack chain analysis"),
      );
    } finally {
      setIsStarting(false);
    }
  }, [modelId, submit]);

  const onJobComplete = useCallback(() => {
    if (modelId) {
      void queryClient.invalidateQueries({
        queryKey: ATTACK_CHAIN_QUERY_KEYS.chains(modelId),
      });
    }
    toast.success("Attack chain analysis complete");
  }, [modelId, queryClient]);

  const dismissJob = useCallback(() => setJobId(null), []);

  return { analyze, jobId, isStarting, onJobComplete, dismissJob };
}
