"use client";

import { useQuery } from "@tanstack/react-query";
import { getPresenceCounts } from "../services/api";

/**
 * Poll active collaborator counts for a list of model IDs.
 * Refreshes every 30 seconds while the dashboard is visible.
 */
export function usePresence(modelIds: string[]) {
  return useQuery({
    queryKey: ["presence", modelIds],
    queryFn: () => getPresenceCounts(modelIds),
    enabled: modelIds.length > 0,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}
