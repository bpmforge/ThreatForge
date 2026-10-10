"use client";

import { useState, useMemo, useCallback } from "react";
import type { ComponentType, StrideCategory } from "@/types/canvas";
import type { ThreatSuggestion, SuggestionGroup } from "../types";
import { THREAT_TEMPLATES } from "../constants/templates";

/**
 * Hook to provide threat suggestions based on component type.
 */
export function useComponentSuggestions(
  componentType: ComponentType | null,
  existingThreatIds?: string[],
): {
  suggestions: ThreatSuggestion[];
  groupedByStride: SuggestionGroup[];
  dismiss: (suggestionId: string) => void;
  dismissedCount: number;
} {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const dismiss = useCallback((suggestionId: string) => {
    setDismissedIds((prev) => new Set(prev).add(suggestionId));
  }, []);

  const filteredSuggestions = useMemo(() => {
    if (!componentType) return [];

    // Get templates applicable to this component type
    const applicableTemplates = THREAT_TEMPLATES.filter((template) =>
      template.applicableTypes.includes(componentType),
    );

    // Filter out dismissed and existing threats
    return applicableTemplates
      .filter((template) => !dismissedIds.has(template.id))
      .filter((template) => !existingThreatIds?.includes(template.id));
  }, [componentType, dismissedIds, existingThreatIds]);

  const groupedByStride = useMemo((): SuggestionGroup[] => {
    if (!componentType) return [];

    const groups: Record<StrideCategory, ThreatSuggestion[]> = {} as Record<
      StrideCategory,
      ThreatSuggestion[]
    >;

    filteredSuggestions.forEach((suggestion) => {
      const category = suggestion.strideCategory;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(suggestion);
    });

    return Object.entries(groups).map(([category, suggestions]) => ({
      category: category as StrideCategory,
      suggestions,
    }));
  }, [filteredSuggestions, componentType]);

  return {
    suggestions: filteredSuggestions,
    groupedByStride,
    dismiss,
    dismissedCount: dismissedIds.size,
  };
}
