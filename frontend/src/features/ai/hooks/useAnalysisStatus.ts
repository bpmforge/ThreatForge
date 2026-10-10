import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";

interface ComponentStatus {
  nodeId: string;
  analyzedAt: string | null;
}

interface AnalysisStatus {
  total: number;
  dirty: number;
  clean: number;
  hasEverBeenAnalyzed: boolean;
  components: ComponentStatus[];
}

async function fetchAnalysisStatus(modelId: string): Promise<AnalysisStatus> {
  let data: Array<{ nodeId: string; analyzedAt: string | null }> | undefined;
  try {
    data = await apiGet<typeof data>(
      `/api/threat-models/${modelId}/components`,
    );
  } catch {
    throw new Error("Failed to fetch components");
  }
  const components = (data ?? []).map((c) => ({
    nodeId: c.nodeId,
    analyzedAt: c.analyzedAt,
  }));
  const dirty = components.filter((c) => !c.analyzedAt).length;
  const clean = components.length - dirty;
  return {
    total: components.length,
    dirty,
    clean,
    hasEverBeenAnalyzed: clean > 0,
    components,
  };
}

export function useAnalysisStatus(modelId: string | null) {
  return useQuery({
    queryKey: ["analysis-status", modelId],
    queryFn: () => fetchAnalysisStatus(modelId!),
    enabled: !!modelId,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
}
