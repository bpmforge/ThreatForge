"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { ComponentType } from "@/types/canvas";
import type { ComponentSuggestions, ThreatSuggestion } from "../types";
import { getSuggestionsForComponentType } from "../data/common-threats-by-type";
import { apiPost } from "@/lib/api-client";

interface UseAutoSuggestionsOptions {
  enabled?: boolean;
  autoShowDelay?: number;
  /** Use AI endpoint for suggestions (requires modelId) */
  useAI?: boolean;
  /** Model ID for AI suggestions */
  modelId?: string;
}

interface UseAutoSuggestionsReturn {
  /** Suggestions for a specific component */
  getSuggestions: (componentId: string) => ComponentSuggestions | undefined;
  /** Trigger suggestions for a component (componentName enables AI suggestions) */
  triggerSuggestions: (
    componentId: string,
    componentType: ComponentType,
    componentName?: string,
  ) => void;
  /** Dismiss suggestions for a component */
  dismissSuggestions: (componentId: string) => void;
  /** Mark a suggestion as added (removes from list) */
  markSuggestionAdded: (componentId: string, suggestionId: string) => void;
  /** Get count of pending suggestions for a component */
  getPendingCount: (componentId: string) => number;
  /** Get highest severity of pending suggestions */
  getHighestSeverity: (
    componentId: string,
  ) => "low" | "medium" | "high" | "critical" | null;
  /** All active suggestions by component */
  allSuggestions: Map<string, ComponentSuggestions>;
  /** Clear all suggestions */
  clearAll: () => void;
}

/** Fetch AI-powered suggestions from backend */
async function fetchAISuggestions(
  modelId: string,
  componentType: ComponentType,
  componentName: string,
): Promise<ThreatSuggestion[]> {
  try {
    const data = await apiPost<{
      success?: boolean;
      threats?: Array<{
        title: string;
        description: string;
        category: string;
        severity: string;
        confidence: number;
      }>;
    }>(`/api/threat-models/${modelId}/ai/auto-suggest`, {
      component: { type: componentType, name: componentName },
    });

    if (!data.success || !data.threats) return [];

    // Map AI response to ThreatSuggestion format
    return data.threats.map(
      (
        t: {
          title: string;
          description: string;
          category: string;
          severity: string;
          confidence: number;
        },
        i: number,
      ) => ({
        id: `ai-${componentType}-${i}`,
        title: t.title,
        description: t.description,
        strideCategory: t.category as ThreatSuggestion["strideCategory"],
        severity: t.severity.toLowerCase() as
          | "low"
          | "medium"
          | "high"
          | "critical",
        confidence: t.confidence || 0.8,
        mitigations: [],
      }),
    );
  } catch {
    return [];
  }
}

export function useAutoSuggestions(
  options: UseAutoSuggestionsOptions = {},
): UseAutoSuggestionsReturn {
  const {
    enabled = true,
    autoShowDelay = 500,
    useAI = false,
    modelId,
  } = options;
  const [suggestions, setSuggestions] = useState<
    Map<string, ComponentSuggestions>
  >(new Map());
  const timeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRef.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  const triggerSuggestions = useCallback(
    (
      componentId: string,
      componentType: ComponentType,
      componentName?: string,
    ) => {
      if (!enabled) return;

      // Clear any existing timeout for this component
      const existingTimeout = timeoutRef.current.get(componentId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Delay suggestion generation for UX
      const timeout = setTimeout(async () => {
        let componentSuggestions: ThreatSuggestion[];

        // Try AI endpoint if enabled and modelId is available
        if (useAI && modelId && componentName) {
          componentSuggestions = await fetchAISuggestions(
            modelId,
            componentType,
            componentName,
          );
        } else {
          componentSuggestions = [];
        }

        // Fall back to static data if AI returned nothing
        if (componentSuggestions.length === 0) {
          componentSuggestions = getSuggestionsForComponentType(componentType);
        }

        if (componentSuggestions.length > 0) {
          setSuggestions((prev) => {
            const next = new Map(prev);
            next.set(componentId, {
              componentId,
              componentType,
              suggestions: componentSuggestions,
              dismissed: false,
              timestamp: Date.now(),
            });
            return next;
          });
        }

        timeoutRef.current.delete(componentId);
      }, autoShowDelay);

      timeoutRef.current.set(componentId, timeout);
    },
    [enabled, autoShowDelay, useAI, modelId],
  );

  const dismissSuggestions = useCallback((componentId: string) => {
    setSuggestions((prev) => {
      const next = new Map(prev);
      const existing = next.get(componentId);
      if (existing) {
        next.set(componentId, { ...existing, dismissed: true });
      }
      return next;
    });
  }, []);

  const markSuggestionAdded = useCallback(
    (componentId: string, suggestionId: string) => {
      setSuggestions((prev) => {
        const next = new Map(prev);
        const existing = next.get(componentId);
        if (existing) {
          next.set(componentId, {
            ...existing,
            suggestions: existing.suggestions.filter(
              (s) => s.id !== suggestionId,
            ),
          });
        }
        return next;
      });
    },
    [],
  );

  const getSuggestions = useCallback(
    (componentId: string) => suggestions.get(componentId),
    [suggestions],
  );

  const getPendingCount = useCallback(
    (componentId: string) => {
      const componentSuggestions = suggestions.get(componentId);
      if (!componentSuggestions || componentSuggestions.dismissed) return 0;
      return componentSuggestions.suggestions.length;
    },
    [suggestions],
  );

  const getHighestSeverity = useCallback(
    (componentId: string): "low" | "medium" | "high" | "critical" | null => {
      const componentSuggestions = suggestions.get(componentId);
      if (
        !componentSuggestions ||
        componentSuggestions.dismissed ||
        componentSuggestions.suggestions.length === 0
      ) {
        return null;
      }

      const severityOrder: Record<string, number> = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
      };
      let highest: "low" | "medium" | "high" | "critical" = "low";
      let highestScore = 0;

      for (const suggestion of componentSuggestions.suggestions) {
        const score = severityOrder[suggestion.severity] || 0;
        if (score > highestScore) {
          highestScore = score;
          highest = suggestion.severity;
        }
      }

      return highest;
    },
    [suggestions],
  );

  const clearAll = useCallback(() => {
    setSuggestions(new Map());
    timeoutRef.current.forEach((timeout) => clearTimeout(timeout));
    timeoutRef.current.clear();
  }, []);

  return {
    getSuggestions,
    triggerSuggestions,
    dismissSuggestions,
    markSuggestionAdded,
    getPendingCount,
    getHighestSeverity,
    allSuggestions: suggestions,
    clearAll,
  };
}
