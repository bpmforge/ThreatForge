/**
 * Hook to list user's recent AI jobs
 */
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";

interface AiJobSummary {
  id: string;
  type: string;
  status: string;
  progress: number;
  progressMessage: string | null;
  error: string | null;
  result: string | null;
  queuedAt: string;
}

interface JobListFilters {
  status?: string;
  type?: string;
  threatModelId?: string;
  limit?: number;
}

/** Fetches the caller's AI jobs as a plain array. */
export async function fetchJobList(
  filters?: JobListFilters,
): Promise<AiJobSummary[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.type) params.set("type", filters.type);
  if (filters?.threatModelId)
    params.set("threatModelId", filters.threatModelId);
  if (filters?.limit) params.set("limit", String(filters.limit));
  // The list endpoint answers { data, pagination }, which apiGet returns
  // as-is rather than unwrapping.
  const res = await apiGet<{ data: AiJobSummary[] }>(`/api/ai-jobs?${params}`);
  return res.data;
}

export function useJobList(filters?: JobListFilters) {
  return useQuery({
    queryKey: ["ai-jobs", filters],
    queryFn: () => fetchJobList(filters),
    refetchInterval: (query) => {
      const jobs = query.state.data;
      if (!jobs) return 3000;
      const hasActive = jobs.some(
        (j) => j.status === "QUEUED" || j.status === "PROCESSING",
      );
      return hasActive ? 3000 : false;
    },
  });
}
