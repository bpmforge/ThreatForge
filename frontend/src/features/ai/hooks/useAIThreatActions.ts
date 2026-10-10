"use client";

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAISuggestions } from "./useAISuggestions";
import { useAnalysisStatus } from "./useAnalysisStatus";
import { useJobList } from "@/features/ai-jobs/hooks/useJobList";
import { useThreatModel } from "@/features/dashboard";
import { ApiError, apiPost, apiDelete } from "@/lib/api-client";
import * as api from "../services/api";

export function useAIThreatActions(modelId: string | null) {
  const [methodology, setMethodology] = useState("stride");
  const [quickMode, setQuickMode] = useState(false);
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [refreshingMitigations, setRefreshingMitigations] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const { threats, loading, error, jobId, suggestThreats, clearSuggestions } =
    useAISuggestions({ modelId, async: !quickMode });
  const { data: analysisStatus, refetch: refetchStatus } =
    useAnalysisStatus(modelId);
  const { data: threatModel, refetch: refetchModel } = useThreatModel(
    modelId ?? undefined,
  );
  const mitigationsStale = !!(
    threatModel as { mitigationsStaleAt?: string | null } | undefined
  )?.mitigationsStaleAt;
  const { data: jobs, refetch: refetchJobs } = useJobList({
    type: "SUGGEST_THREATS",
    threatModelId: modelId ?? undefined,
    limit: 8,
  });

  const queryClient = useQueryClient();
  const seenMessages = useRef(new Set<string>());

  useEffect(() => {
    for (const job of (jobs ?? []).filter(
      (j) =>
        j.status === "PROCESSING" && j.progressMessage?.startsWith("Persisted"),
    )) {
      const key = `${job.id}:${job.progressMessage}`;
      if (!seenMessages.current.has(key)) {
        seenMessages.current.add(key);
        queryClient.invalidateQueries({ queryKey: ["threats", modelId] });
      }
    }
  }, [jobs, modelId, queryClient]);

  useEffect(() => {
    if (!modelId) {
      setAvailable(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    api.checkAIAvailability(modelId).then((r) => {
      setAvailable(r.available);
      setChecking(false);
    });
  }, [modelId]);

  function handleDismiss(id: string) {
    setDismissed((prev) => new Set([...prev, id]));
  }

  async function handleCancel(id: string) {
    setBusy((p) => new Set([...p, id]));
    try {
      await apiDelete(`/api/ai-jobs/${id}`);
      toast.info("Cancellation requested — job will stop after current step");
      await refetchJobs();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
        await refetchJobs();
      } else {
        toast.error("Cancel request failed — check network");
      }
    } finally {
      setBusy((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
    }
  }

  async function handlePause(id: string) {
    setBusy((p) => new Set([...p, id]));
    try {
      await apiPost(`/api/ai-jobs/${id}/pause`);
      toast.info("Paused — use Resume to continue from the last checkpoint");
      await refetchJobs();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
        await refetchJobs();
      } else {
        toast.error("Pause request failed — check network");
      }
    } finally {
      setBusy((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
    }
  }

  async function handleRetry(id: string) {
    setBusy((p) => new Set([...p, id]));
    try {
      const body = await apiPost<{ mode?: string } | undefined>(
        `/api/ai-jobs/${id}/retry`,
      );
      await refetchJobs();
      toast.info(
        body?.mode === "resume"
          ? "Resuming from checkpoint — skipping completed components"
          : "Starting fresh — checkpoint was stale (model components changed)",
      );
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      toast.error("Failed to retry job");
    } finally {
      setBusy((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
    }
  }

  async function handleRegenerateMitigations() {
    if (!modelId || loading) return;
    try {
      await apiPost(`/api/threat-models/${modelId}/ai/micro-analysis`, {
        mitigationsOnly: true,
      });
      toast.info("Mitigation regeneration queued — running in the background.");
    } catch {
      toast.error("Failed to queue mitigation regeneration.");
    }
  }

  async function handleRescoreOnly() {
    if (!modelId || rescoring) return;
    setRescoring(true);
    try {
      const data = await apiPost<{ rescored?: number }>(
        `/api/threat-models/${modelId}/ai/rescore`,
        {},
      );
      toast.success(
        `CVSS scores recalculated for ${data.rescored ?? 0} threats.`,
      );
    } catch {
      toast.error("Score recalculation failed.");
    } finally {
      setRescoring(false);
    }
  }

  async function handleRefreshMitigations() {
    if (!modelId || refreshingMitigations) return;
    setRefreshingMitigations(true);
    try {
      await apiPost(`/api/threat-models/${modelId}/ai/refresh-mitigations`);
      toast.info("Mitigation refresh queued — running in the background.");
      await refetchModel();
    } catch {
      toast.error("Failed to queue mitigation refresh.");
    } finally {
      setRefreshingMitigations(false);
    }
  }

  async function handleVerifyCitations() {
    if (!modelId || verifying) return;
    setVerifying(true);
    try {
      const data = await apiPost<{
        success: boolean;
        async?: boolean;
        data?: { verified: number; unverified: number; total: number };
      }>(`/api/threat-models/${modelId}/citations/verify-batch`);
      if (!data.success) throw new Error("Batch verify failed");
      if (data.async) {
        toast.info("Citation verification running in the background.");
      } else {
        const s = data.data;
        toast.success(
          s
            ? `Citations verified: ${s.verified}/${s.total} passed.`
            : "Citation verification complete.",
        );
      }
    } catch {
      toast.error("Citation verification failed. Check AI settings.");
    } finally {
      setVerifying(false);
    }
  }

  return {
    methodology,
    setMethodology,
    quickMode,
    setQuickMode,
    available,
    checking,
    verifying,
    refreshingMitigations,
    rescoring,
    dismissed,
    busy,
    threats,
    loading,
    error,
    jobId,
    suggestThreats,
    clearSuggestions,
    analysisStatus,
    refetchStatus,
    mitigationsStale,
    jobs,
    handleDismiss,
    handleCancel,
    handlePause,
    handleRetry,
    handleRegenerateMitigations,
    handleRescoreOnly,
    handleRefreshMitigations,
    handleVerifyCitations,
  };
}
