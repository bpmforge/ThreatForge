import type { ComplianceAnalysis, Framework } from "../types";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";

export function useCompliance(modelId: string, framework: Framework) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["compliance", modelId, framework],
    queryFn: async () => {
      try {
        return await apiGet<ComplianceAnalysis>(
          `/api/threat-models/${modelId}/compliance?framework=${framework}`,
        );
      } catch {
        throw new Error("Failed to fetch compliance data");
      }
    },
  });

  return {
    data: data ?? null,
    isLoading,
    error: error as Error | null,
  };
}
