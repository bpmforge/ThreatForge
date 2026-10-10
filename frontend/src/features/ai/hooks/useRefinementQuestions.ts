/**
 * Hook for fetching refinement questions.
 */
import { useState, useCallback } from "react";
import { getRefinementQuestions } from "../services/refinement";
import { toast } from "sonner";
import type { RefinementResponse } from "../types";

export function useRefinementQuestions(modelId: string | null) {
  const [data, setData] = useState<RefinementResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchQuestions = useCallback(async () => {
    if (!modelId) return;
    setLoading(true);
    try {
      const result = await getRefinementQuestions(modelId);
      setData(result);
    } catch {
      toast.error("Failed to fetch refinement questions");
    } finally {
      setLoading(false);
    }
  }, [modelId]);

  return { data, loading, fetchQuestions };
}
