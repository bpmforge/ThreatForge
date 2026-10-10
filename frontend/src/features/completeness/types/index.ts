/**
 * Completeness feature types.
 */
import type { StrideCategory } from "@/types/canvas";

export type StrideCoverageMap = Record<
  StrideCategory,
  { covered: number; total: number }
>;

export interface CompletenessScore {
  overall: number;
  componentsCovered: number;
  totalComponents: number;
  threatsWithMitigations: number;
  totalThreats: number;
  strideCoverage: StrideCoverageMap;
}

export interface ComponentGap {
  componentId: string;
  componentLabel: string;
  missingCategories: StrideCategory[];
  threatCount: number;
}

export interface ImprovementSuggestion {
  id: string;
  type: "missing_stride" | "no_mitigation" | "uncovered_component";
  message: string;
  componentId?: string;
  componentName?: string;
  threatId?: string;
  priority: "high" | "medium" | "low";
  details: string;
}
