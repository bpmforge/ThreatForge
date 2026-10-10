import type { ThreatModelVersionDetail } from "../types";

export interface CanvasNode {
  id: string;
  type?: string;
  data?: {
    label?: string;
    name?: string;
    type?: string;
    [key: string]: unknown;
  };
  position?: { x: number; y: number };
  [key: string]: unknown;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
  data?: {
    label?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface DiffResult {
  nodesAdded: CanvasNode[];
  nodesRemoved: CanvasNode[];
  nodesModified: { before: CanvasNode; after: CanvasNode; changes: string[] }[];
  edgesAdded: CanvasEdge[];
  edgesRemoved: CanvasEdge[];
  summary: {
    totalChanges: number;
    nodesAdded: number;
    nodesRemoved: number;
    nodesModified: number;
    edgesAdded: number;
    edgesRemoved: number;
  };
}

export function getNodeLabel(node: CanvasNode): string {
  return node.data?.label || node.data?.name || node.type || node.id;
}

export function getEdgeLabel(edge: CanvasEdge): string {
  return edge.label || edge.data?.label || `${edge.source} → ${edge.target}`;
}

export function compareVersions(
  base: ThreatModelVersionDetail | undefined,
  compare: ThreatModelVersionDetail | undefined,
): DiffResult | null {
  if (!base || !compare) return null;

  const baseNodes = (base.canvasState?.nodes || []) as CanvasNode[];
  const compareNodes = (compare.canvasState?.nodes || []) as CanvasNode[];
  const baseEdges = (base.canvasState?.edges || []) as CanvasEdge[];
  const compareEdges = (compare.canvasState?.edges || []) as CanvasEdge[];

  const baseNodeMap = new Map(baseNodes.map((n) => [n.id, n]));
  const compareNodeMap = new Map(compareNodes.map((n) => [n.id, n]));
  const baseEdgeMap = new Map(baseEdges.map((e) => [e.id, e]));
  const compareEdgeMap = new Map(compareEdges.map((e) => [e.id, e]));

  const nodesAdded = compareNodes.filter((n) => !baseNodeMap.has(n.id));
  const nodesRemoved = baseNodes.filter((n) => !compareNodeMap.has(n.id));

  const nodesModified: DiffResult["nodesModified"] = [];
  for (const baseNode of baseNodes) {
    const compareNode = compareNodeMap.get(baseNode.id);
    if (compareNode) {
      const changes: string[] = [];

      const baseLabel = getNodeLabel(baseNode);
      const compareLabel = getNodeLabel(compareNode);
      if (baseLabel !== compareLabel) {
        changes.push(`Label: "${baseLabel}" → "${compareLabel}"`);
      }

      if (baseNode.type !== compareNode.type) {
        changes.push(`Type: ${baseNode.type} → ${compareNode.type}`);
      }

      if (baseNode.position && compareNode.position) {
        const dx = Math.abs(
          (baseNode.position.x || 0) - (compareNode.position.x || 0),
        );
        const dy = Math.abs(
          (baseNode.position.y || 0) - (compareNode.position.y || 0),
        );
        if (dx > 50 || dy > 50) {
          changes.push("Position moved");
        }
      }

      const baseData = JSON.stringify(baseNode.data);
      const compareData = JSON.stringify(compareNode.data);
      if (baseData !== compareData && changes.length === 0) {
        changes.push("Properties changed");
      }

      if (changes.length > 0) {
        nodesModified.push({ before: baseNode, after: compareNode, changes });
      }
    }
  }

  const edgesAdded = compareEdges.filter((e) => !baseEdgeMap.has(e.id));
  const edgesRemoved = baseEdges.filter((e) => !compareEdgeMap.has(e.id));

  return {
    nodesAdded,
    nodesRemoved,
    nodesModified,
    edgesAdded,
    edgesRemoved,
    summary: {
      totalChanges:
        nodesAdded.length +
        nodesRemoved.length +
        nodesModified.length +
        edgesAdded.length +
        edgesRemoved.length,
      nodesAdded: nodesAdded.length,
      nodesRemoved: nodesRemoved.length,
      nodesModified: nodesModified.length,
      edgesAdded: edgesAdded.length,
      edgesRemoved: edgesRemoved.length,
    },
  };
}
