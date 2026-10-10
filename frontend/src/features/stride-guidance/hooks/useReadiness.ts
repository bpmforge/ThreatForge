"use client";

import { useMemo } from "react";
import { useCanvasStore } from "@/stores/canvas";
import {
  calculateReadiness,
  type ModelContext,
} from "../data/readiness-criteria";
import type { ReadinessResult } from "../types";
import type { ComponentNodeData } from "@/types/canvas";

export function useReadiness(): ReadinessResult {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);

  return useMemo(() => {
    // Build model context from canvas state
    const componentNodes = nodes.filter((n) => n.type === "component");
    const boundaryNodes = nodes.filter((n) => n.type === "boundary");

    // Collect all threats from components
    const allThreats: Array<{
      mitigated: boolean;
      severity: string;
      strideCategory: string;
    }> = [];
    const componentsWithoutThreats: string[] = [];

    componentNodes.forEach((node) => {
      const data = node.data as ComponentNodeData;
      const threats = data.threats || [];

      if (threats.length === 0) {
        componentsWithoutThreats.push(data.label);
      }

      threats.forEach((t) => {
        allThreats.push({
          mitigated: t.mitigated || false,
          severity: t.severity || "MEDIUM",
          strideCategory: t.category || "TAMPERING",
        });
      });
    });

    // Calculate STRIDE coverage
    const strideCoverage: Record<string, number> = {
      SPOOFING: 0,
      TAMPERING: 0,
      REPUDIATION: 0,
      INFORMATION_DISCLOSURE: 0,
      DENIAL_OF_SERVICE: 0,
      ELEVATION_OF_PRIVILEGE: 0,
    };

    allThreats.forEach((t) => {
      if (strideCoverage[t.strideCategory] !== undefined) {
        strideCoverage[t.strideCategory]++;
      }
    });

    // Count critical unmitigated threats
    const criticalThreatsUnmitigated = allThreats.filter(
      (t) => t.severity === "CRITICAL" && !t.mitigated,
    ).length;

    const context: ModelContext = {
      componentCount: componentNodes.length,
      threatCount: allThreats.length,
      mitigatedThreatCount: allThreats.filter((t) => t.mitigated).length,
      boundaryCount: boundaryNodes.length,
      dataFlowCount: edges.length,
      strideCoverage,
      componentsWithoutThreats,
      criticalThreatsUnmitigated,
      hasDescription: false, // Could be extended
    };

    return calculateReadiness(context);
  }, [nodes, edges]);
}
