/**
 * useAttackPaths - Calculates attack paths through the threat model.
 *
 * Analyzes edges and threats to find potential attack chains.
 * Accepts optional nodes/edges overrides; falls back to canvas store.
 */
import { useMemo } from "react";
import { useCanvasStore } from "@/stores/canvas";
import type { AttackPath, AttackStep } from "../types";
import type { StrideCategory, ComponentNodeData } from "@/types/canvas";
import type { CanvasNode, CanvasEdge } from "@/stores/canvas";

const SEVERITY_WEIGHTS = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

const ENTRY_TYPES = new Set([
  "ACTOR",
  "EXTERNAL_ENTITY",
  "WEB_APP",
  "MOBILE_APP",
  "DESKTOP_APP",
  "API",
  "API_GATEWAY",
]);

interface UseAttackPathsOptions {
  threats?: Array<{
    id: string;
    title?: string;
    name?: string;
    componentId?: string;
    componentNodeId?: string;
    category?: StrideCategory | string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  }>;
  /** Override nodes (for analytics pages where canvas store is empty) */
  nodes?: CanvasNode[];
  /** Override edges (for analytics pages where canvas store is empty) */
  edges?: CanvasEdge[];
}

export function useAttackPaths({
  threats = [],
  nodes: nodesOverride,
  edges: edgesOverride,
}: UseAttackPathsOptions = {}) {
  const storeNodes = useCanvasStore((s) => s.nodes);
  const storeEdges = useCanvasStore((s) => s.edges);

  const nodes = nodesOverride ?? storeNodes;
  const edges = edgesOverride ?? storeEdges;

  // Build adjacency map
  const adjacency = useMemo(() => {
    const map = new Map<string, string[]>();
    edges.forEach((edge) => {
      const targets = map.get(edge.source) ?? [];
      targets.push(edge.target);
      map.set(edge.source, targets);
    });
    return map;
  }, [edges]);

  // Map threats to nodes by componentNodeId or componentId
  const threatsByNode = useMemo(() => {
    const map = new Map<string, typeof threats>();
    threats.forEach((t) => {
      const nodeId = t.componentNodeId ?? t.componentId;
      if (!nodeId) return;
      const list = map.get(nodeId) ?? [];
      list.push(t);
      map.set(nodeId, list);
    });
    return map;
  }, [threats]);

  // Find all paths using DFS
  const attackPaths = useMemo<AttackPath[]>(() => {
    if (nodes.length === 0 || threats.length === 0) return [];

    const paths: AttackPath[] = [];
    // Entry nodes — components that represent external actors or entry points
    const entryNodes = nodes.filter((n) => {
      if (n.type !== "component") return false;
      const nodeType = (n.data as ComponentNodeData).type;
      return nodeType && ENTRY_TYPES.has(nodeType);
    });

    function dfs(
      nodeId: string,
      path: AttackStep[],
      visited: Set<string>,
    ): void {
      if (visited.has(nodeId) || path.length > 10) return;
      visited.add(nodeId);

      const nodeThreats = threatsByNode.get(nodeId) ?? [];
      const node = nodes.find((n) => n.id === nodeId);
      const nodeName = (node?.data as { label?: string })?.label ?? "Unknown";

      nodeThreats.forEach((threat) => {
        path.push({
          id: `${nodeId}-${threat.id}`,
          nodeId,
          nodeName,
          threatId: threat.id,
          threatName: threat.name ?? threat.title ?? "Unknown threat",
          category: (threat.category as StrideCategory) ?? "SPOOFING",
          severity: threat.severity,
        });
      });

      const neighbors = adjacency.get(nodeId) ?? [];
      if (neighbors.length === 0 && path.length >= 2) {
        const totalRisk = path.reduce(
          (sum, s) => sum + (SEVERITY_WEIGHTS[s.severity] ?? 1),
          0,
        );
        paths.push({
          id: `path-${paths.length}`,
          name: `${path[0].nodeName} → ${path[path.length - 1].nodeName}`,
          description: `Attack chain through ${path.length} step${path.length !== 1 ? "s" : ""}`,
          steps: [...path],
          totalRisk,
          entryPoint: path[0].nodeName,
          target: path[path.length - 1].nodeName,
          likelihood:
            totalRisk > 10 ? "HIGH" : totalRisk > 5 ? "MEDIUM" : "LOW",
          impact: path.some((s) => s.severity === "CRITICAL")
            ? "CRITICAL"
            : path.some((s) => s.severity === "HIGH")
              ? "HIGH"
              : "MEDIUM",
        });
      }

      neighbors.forEach((neighbor) =>
        dfs(neighbor, [...path], new Set(visited)),
      );
    }

    entryNodes.forEach((node) => dfs(node.id, [], new Set()));
    return paths.sort((a, b) => b.totalRisk - a.totalRisk).slice(0, 20);
  }, [nodes, adjacency, threatsByNode, threats.length]);

  return { attackPaths, hasData: attackPaths.length > 0 };
}
