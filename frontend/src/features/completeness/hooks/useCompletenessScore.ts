"use client";

import { useMemo } from "react";
import { useCanvasStore } from "@/stores/canvas";
import { useThreats } from "@/features/threats/hooks/useThreats";
import { STRIDE_CATEGORIES } from "@/features/threats/constants";
import type { StrideCategory } from "@/types/canvas";
import type { Threat } from "@/features/threats/types";
import type {
  CompletenessScore,
  ComponentGap,
  ImprovementSuggestion,
  StrideCoverageMap,
} from "../types";

/**
 * Hook to calculate completeness scores for components based on STRIDE threat modeling.
 *
 * @param modelId - The threat model ID to fetch threats for
 */
export function useCompletenessScore(modelId: string | null | undefined): {
  score: CompletenessScore;
  gaps: ComponentGap[];
  suggestions: ImprovementSuggestion[];
  isCalculating: boolean;
} {
  // Fine-grained selector prevents re-renders on unrelated store mutations
  // (e.g. selectedNodeIds, isDirty, viewport changes during canvas interaction)
  const nodes = useCanvasStore((s) => s.nodes);
  const threatsQuery = useThreats(modelId);
  const threats: Threat[] = threatsQuery.data ?? [];

  const componentNodes = useMemo(() => {
    return nodes.filter((node) => node.type === "component");
  }, [nodes]);

  const result = useMemo(() => {
    const strideCategories = STRIDE_CATEGORIES.map((c) => c.value);

    // Initialize STRIDE coverage map
    const strideCoverage: StrideCoverageMap = {} as StrideCoverageMap;
    strideCategories.forEach((category) => {
      strideCoverage[category] = { covered: 0, total: 0 };
    });

    const componentGaps: ComponentGap[] = [];
    const improvementSuggestions: ImprovementSuggestion[] = [];

    let componentsCovered = 0;
    let threatsWithMitigations = 0;

    componentNodes.forEach((node) => {
      const componentId = node.id;
      const componentLabel =
        (node.data as { label?: string })?.label || `Component ${componentId}`;

      // Find threats for this component
      const componentThreats = threats.filter(
        (threat: Threat) => threat.componentNodeId === componentId,
      );

      // Track which STRIDE categories are covered for this component
      const coveredCategories = new Set<StrideCategory>();
      componentThreats.forEach((threat: Threat) => {
        threat.strideCategories.forEach((category: StrideCategory) => {
          coveredCategories.add(category);
          if (strideCoverage[category]) {
            strideCoverage[category].covered++;
          }
        });
        if (
          threat.strideCategories[0] &&
          strideCoverage[threat.strideCategories[0]]
        ) {
          strideCoverage[threat.strideCategories[0]].total++;
        }

        // Count mitigated threats
        if (threat.mitigations?.length > 0) {
          threatsWithMitigations++;
        }
      });

      // Determine if component is covered (has at least one threat)
      if (componentThreats.length > 0) {
        componentsCovered++;
      } else {
        improvementSuggestions.push({
          id: `uncovered-${componentId}`,
          type: "uncovered_component",
          message: `Component "${componentLabel}" has no threats identified`,
          componentId,
          componentName: componentLabel,
          priority: "high",
          details: `Consider adding threats for ${componentLabel} to improve model completeness.`,
        });
      }

      // Find missing STRIDE categories
      const missingCategories = strideCategories.filter(
        (category) => !coveredCategories.has(category),
      );

      if (missingCategories.length > 0 && componentThreats.length > 0) {
        componentGaps.push({
          componentId,
          componentLabel,
          missingCategories,
          threatCount: componentThreats.length,
        });

        improvementSuggestions.push({
          id: `missing-stride-${componentId}`,
          type: "missing_stride",
          message: `Component "${componentLabel}" is missing STRIDE coverage`,
          componentId,
          componentName: componentLabel,
          priority: "medium",
          details: `Missing categories: ${missingCategories.map((c) => STRIDE_CATEGORIES.find((sc) => sc.value === c)?.short).join(", ")}`,
        });
      }

      // Check for unmitigated threats
      const unmitigatedThreats = componentThreats.filter(
        (threat: Threat) => !threat.mitigations?.length,
      );
      if (unmitigatedThreats.length > 0) {
        improvementSuggestions.push({
          id: `unmitigated-${componentId}`,
          type: "no_mitigation",
          message: `${unmitigatedThreats.length} threats without mitigations for "${componentLabel}"`,
          componentId,
          componentName: componentLabel,
          priority: "high",
          details: `Found ${unmitigatedThreats.length} threats that need mitigation strategies.`,
        });
      }
    });

    // Calculate overall score
    const totalComponents = componentNodes.length;
    const totalThreats = threats.length;
    const overall =
      totalComponents > 0
        ? Math.round((componentsCovered / totalComponents) * 100)
        : 0;

    return {
      score: {
        overall,
        componentsCovered,
        totalComponents,
        threatsWithMitigations,
        totalThreats,
        strideCoverage,
      },
      gaps: componentGaps,
      suggestions: improvementSuggestions.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }),
    };
  }, [componentNodes, threats]);

  return {
    ...result,
    isCalculating: threatsQuery.isLoading,
  };
}
