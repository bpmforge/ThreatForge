"use client";

import { useMemo } from "react";
import { useCanvasStore } from "@/stores/canvas";
import { useThreats } from "@/features/threats/hooks/useThreats";
import { useThreatModel } from "@/features/dashboard";
import {
  calculateMaturityScore,
  type MaturityScore,
} from "@/features/threats/services/maturity-score";

export function useMaturityScore(modelId: string | null | undefined): {
  score: MaturityScore | null;
  isLoading: boolean;
} {
  // Fine-grained selectors prevent re-renders on unrelated store mutations
  // (e.g. selectedNodeIds, isDirty, viewport changes during canvas interaction)
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const threatsQuery = useThreats(modelId);
  const modelQuery = useThreatModel(modelId ?? "");

  const score = useMemo(() => {
    if (!modelId || threatsQuery.isLoading) return null;

    const threats = threatsQuery.data ?? [];
    const componentNodes = nodes.filter((n) => n.type === "component");
    const boundaryNodes = nodes.filter(
      (n) => n.type === "group" || n.type === "boundary",
    );

    const componentIds = new Set(componentNodes.map((n) => n.id));
    const componentsWithThreats = new Set(
      threats
        .map((t) => t.componentNodeId)
        .filter((id): id is string => !!id && componentIds.has(id)),
    ).size;

    const mitigatedThreatCount = threats.filter(
      (t) => t.mitigations && t.mitigations.length > 0,
    ).length;

    const hasBeenReviewed = threats.some(
      (t) => t.reviewStatus === "ACCEPTED" || t.reviewStatus === "MODIFIED",
    );

    const hasDataClassification = componentNodes.some(
      (n) => !!(n.data as { dataClassification?: string }).dataClassification,
    );

    const updatedAt = (modelQuery.data as { updatedAt?: string } | undefined)
      ?.updatedAt;
    const daysSinceUpdate = updatedAt
      ? Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000)
      : 0;

    return calculateMaturityScore({
      componentCount: componentNodes.length,
      connectionCount: edges.length,
      boundaryCount: boundaryNodes.length,
      threatCount: threats.length,
      mitigatedThreatCount,
      componentsWithThreats,
      complianceFrameworksMapped: 0,
      hasBeenReviewed,
      daysSinceUpdate,
      hasDataClassification,
    });
  }, [
    nodes,
    edges,
    threatsQuery.data,
    threatsQuery.isLoading,
    modelId,
    modelQuery.data,
  ]);

  return { score, isLoading: threatsQuery.isLoading || modelQuery.isLoading };
}
