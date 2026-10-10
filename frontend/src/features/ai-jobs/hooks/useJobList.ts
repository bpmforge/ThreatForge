/**
 * Hook to list user's recent AI jobs
 */
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";

interface JobListFilters {
  status?: string;
  type?: string;
  threatModelId?: string;
  limit?: number;
}

export function useJobList(filters?: JobListFilters) {
  return useQuery({
    queryKey: ["ai-jobs", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.type) params.set("type", filters.type);
      if (filters?.threatModelId)
        params.set("threatModelId", filters.threatModelId);
      if (filters?.limit) params.set("limit", String(filters.limit));
      return apiGet<
        Array<{
          id: string;
          type: string;
          status: string;
          progress: number;
          progressMessage: string | null;
          error: string | null;
          result: string | null;
          queuedAt: string;
        }>
      >(`/api/ai-jobs?${params}`);
    },
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
