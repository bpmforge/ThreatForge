import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";

export type PatternKind = "name" | "category" | "cwe";

interface SystemicPattern {
  kind: PatternKind;
  key: string;
  label: string;
  modelCount: number;
  threatCount: number;
  unmitigatedCount: number;
  severityMix: Record<string, number>;
  maxSeverity: string;
  affectedModels: Array<{
    id: string;
    name: string;
    projectName: string;
    threatCount: number;
    unmitigatedCount: number;
  }>;
}

export interface SystemicPatternsResult {
  organizationId: string;
  minModels: number;
  totalModels: number;
  patterns: SystemicPattern[];
}

/** Recurring threat patterns across every model in the organization. */
export function useSystemicPatterns(orgId: string | null, minModels: number) {
  return useQuery<SystemicPatternsResult>({
    queryKey: ["systemic-patterns", orgId, minModels],
    queryFn: () =>
      apiGet<SystemicPatternsResult>(
        `/api/reporting/patterns/${orgId}?minModels=${minModels}`,
      ),
    enabled: !!orgId,
  });
}
