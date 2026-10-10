import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { AttackSurfaceAnalysis } from "../types";

export function useAttackSurface(modelId: string | undefined) {
  return useQuery({
    queryKey: ["attack-surface", modelId],
    queryFn: () =>
      apiGet<AttackSurfaceAnalysis>(`/api/attack-surface/${modelId}`),
    enabled: !!modelId,
  });
}
