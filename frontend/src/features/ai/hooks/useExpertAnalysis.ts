/**
 * Hook for submitting and tracking expert analysis jobs.
 * Persists results by loading from the most recent completed job on mount.
 */
import { useState, useCallback, useEffect } from "react";
import { useSubmitAiJob, aiJobErrorMessage } from "@/features/ai-jobs";
import { useUIStore } from "@/stores/ui-store";
import { toast } from "sonner";
import { apiGet } from "@/lib/api-client";
import type { ExpertAnalysisResult } from "../types";

export function useExpertAnalysis(modelId: string | null) {
  const [result, setResult] = useState<ExpertAnalysisResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { submit } = useSubmitAiJob();
  const setActiveRightPanel = useUIStore((s) => s.setActiveRightPanel);

  // On mount, check for completed expert analysis jobs for this model
  useEffect(() => {
    if (!modelId || result) return;
    apiGet<unknown>(
      `/api/ai-jobs?type=EXPERT_ANALYSIS&status=COMPLETED&threatModelId=${modelId}&limit=1`,
    )
      .then((json) => {
        // Paginated responses come back as { data, pagination }
        const jobs = (json as { data?: unknown } | null)?.data ?? json ?? [];
        if (Array.isArray(jobs) && jobs.length > 0 && jobs[0].result) {
          const parsed =
            typeof jobs[0].result === "string"
              ? JSON.parse(jobs[0].result)
              : jobs[0].result;
          setResult(parsed as ExpertAnalysisResult);
        }
      })
      .catch(() => {});
  }, [modelId, result]);

  const runAnalysis = useCallback(async () => {
    if (!modelId) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await submit(
        `/api/threat-models/${modelId}/ai/expert-analysis`,
        {},
        { async: true },
      );

      if (res.async && res.jobId) {
        setJobId(res.jobId);
        toast.info("Expert Analysis started — 6 passes running in background", {
          description: "Check the job panel for progress.",
        });
      } else if (!res.async && res.result) {
        setResult(res.result as ExpertAnalysisResult);
        setActiveRightPanel("expert");
        toast.success("Expert Analysis complete");
      }
    } catch (err) {
      toast.error(aiJobErrorMessage(err, "Failed to start expert analysis"));
    } finally {
      setLoading(false);
    }
  }, [modelId, submit, setActiveRightPanel]);

  const handleJobComplete = useCallback(
    (jobResult: unknown) => {
      setResult(jobResult as ExpertAnalysisResult);
      setActiveRightPanel("expert");
      toast.success("Expert Analysis complete — view results in Expert tab");
    },
    [setActiveRightPanel],
  );

  return { runAnalysis, result, jobId, loading, handleJobComplete };
}
