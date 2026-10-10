import { getErrorMessage } from "@/lib/errors";
/**
 * Hook for AI threat and mitigation suggestions
 *
 * Supports both sync and async (background job) modes.
 * Async mode lets users navigate away while analysis runs.
 */
import { useState, useCallback } from "react";
import type { AISuggestedThreat, AISuggestedMitigation } from "../types";
import * as api from "../services/api";
import { useSubmitAiJob } from "@/features/ai-jobs";
import { useJobStatus } from "@/features/ai-jobs/hooks/useJobStatus";
import { toast } from "sonner";

interface UseAISuggestionsOptions {
  modelId: string | null;
  /** Use background job mode (default: true) */
  async?: boolean;
}

export function useAISuggestions({
  modelId,
  async: useAsync = true,
}: UseAISuggestionsOptions) {
  const [threats, setThreats] = useState<AISuggestedThreat[]>([]);
  const [mitigations, setMitigations] = useState<AISuggestedMitigation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const { submit } = useSubmitAiJob();

  // Poll for job completion when we have a jobId
  const { data: jobData } = useJobStatus(jobId);

  // When job completes, extract threats
  if (jobData?.status === "COMPLETED" && jobId) {
    const result = jobData.result as {
      threats?: AISuggestedThreat[];
      // Challenger-gate counts, present only when the Verifier stage ran.
      summary?: {
        verification?: {
          confirmed: number;
          uncertain: number;
          refuted: number;
        };
      };
    } | null;
    if (result?.threats && result.threats.length > 0 && threats.length === 0) {
      setThreats(result.threats);
      setJobId(null);
      setLoading(false);
      const v = result.summary?.verification;
      toast.success(
        `AI found ${result.threats.length} threats — view in AI tab`,
        v
          ? {
              description: `${v.confirmed} confirmed · ${v.refuted} refuted & removed · ${v.uncertain} uncertain`,
            }
          : undefined,
      );
    } else if (!result?.threats) {
      setJobId(null);
      setLoading(false);
    }
  }
  if (jobData?.status === "FAILED" && jobId) {
    setError(jobData.error || "Analysis failed");
    setJobId(null);
    setLoading(false);
  }

  const suggestThreats = useCallback(
    async (options?: { methodology?: string; fullAnalysis?: boolean }) => {
      if (!modelId) return;
      setLoading(true);
      setError(null);
      setThreats([]);

      // Deep mode uses micro-analysis (per-component, multi-pass); quick uses suggest-threats (single-pass)
      const endpoint =
        useAsync && options?.methodology
          ? `/api/threat-models/${modelId}/ai/micro-analysis`
          : `/api/threat-models/${modelId}/ai/suggest-threats`;
      const body =
        useAsync && options?.methodology
          ? {
              methodologies: [options.methodology],
              ...(options.fullAnalysis ? { fullAnalysis: true } : {}),
            }
          : {};

      if (useAsync) {
        // Async: submit background job
        try {
          const res = await submit(endpoint, body, { async: true });
          if (res.async && res.jobId) {
            setJobId(res.jobId);
            toast.info("Threat analysis running in background", {
              description:
                "You can navigate away — results will appear when ready.",
            });
          } else if (!res.async && res.result) {
            // Fallback sync (no Redis) — normalize MicroThreat → AISuggestedThreat
            const raw = res.result as {
              threats?: Array<{
                title?: string;
                name?: string;
                description?: string;
                category?: string;
                severity?: string;
                confidence?: number;
              }>;
            };
            const normalized: AISuggestedThreat[] = (raw.threats || []).map(
              (t) => ({
                title: t.title || t.name || "Untitled Threat",
                description: t.description || "",
                category: (t.category ||
                  "INFO_DISCLOSURE") as AISuggestedThreat["category"],
                severity: (t.severity ||
                  "MEDIUM") as AISuggestedThreat["severity"],
                confidence: t.confidence ?? 0.8,
              }),
            );
            setThreats(normalized);
            setLoading(false);
          }
        } catch (err) {
          setError(getErrorMessage(err, "Failed to start analysis"));
          setLoading(false);
        }
      } else {
        // Sync: wait for response
        try {
          const suggestions = await api.suggestThreats(modelId);
          setThreats(suggestions);
        } catch (err) {
          setError(getErrorMessage(err, "Failed to get suggestions"));
        } finally {
          setLoading(false);
        }
      }
    },
    [modelId, useAsync, submit],
  );

  const suggestMitigations = useCallback(
    async (threat: {
      title: string;
      description: string;
      category: string;
    }) => {
      if (!modelId) return;
      setLoading(true);
      setError(null);
      try {
        const suggestions = await api.suggestMitigations(modelId, threat);
        setMitigations(suggestions);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to get mitigations"));
      } finally {
        setLoading(false);
      }
    },
    [modelId],
  );

  const clearSuggestions = useCallback(() => {
    setThreats([]);
    setMitigations([]);
    setError(null);
    setJobId(null);
  }, []);

  return {
    threats,
    mitigations,
    loading,
    error,
    jobId,
    suggestThreats,
    suggestMitigations,
    clearSuggestions,
  };
}
