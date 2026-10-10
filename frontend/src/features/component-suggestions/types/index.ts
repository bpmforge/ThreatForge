/**
 * Component Suggestions feature types.
 */
import type { StrideCategory, ComponentType, Severity } from "@/types/canvas";

export interface ThreatSuggestion {
  id: string;
  name: string;
  description: string;
  strideCategory: StrideCategory;
  severity: Severity;
  applicableTypes: ComponentType[];
  mitigation?: string;
}

export interface SuggestionGroup {
  category: StrideCategory;
  suggestions: ThreatSuggestion[];
}
