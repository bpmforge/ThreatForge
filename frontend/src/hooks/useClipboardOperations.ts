import { useCallback, useRef } from "react";
import {
  useCanvasStore,
  type CanvasNode,
  type CanvasEdge,
} from "@/stores/canvas";

interface ClipboardData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export function useClipboardOperations() {
  const clipboardRef = useRef<ClipboardData | null>(null);

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useCanvasStore((s) => s.selectedEdgeIds);

  const copySelected = useCallback(() => {
    const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
    const selectedEdges = edges.filter(
      (e) =>
        selectedEdgeIds.includes(e.id) ||
        (selectedNodeIds.includes(e.source) &&
          selectedNodeIds.includes(e.target)),
    );
    if (selectedNodes.length > 0 || selectedEdges.length > 0) {
      clipboardRef.current = {
        nodes: selectedNodes,
        edges: selectedEdges,
      } as ClipboardData;
    }
  }, [nodes, edges, selectedNodeIds, selectedEdgeIds]);

  const paste = useCallback(() => {
    if (!clipboardRef.current) return;
    const { nodes: copiedNodes, edges: copiedEdges } = clipboardRef.current;
    if (copiedNodes.length === 0) return;

    const idMap = new Map<string, string>();
    const offset = { x: 50, y: 50 };

    const newNodes: CanvasNode[] = copiedNodes.map((node) => {
      const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      idMap.set(node.id, newId);
      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + offset.x,
          y: node.position.y + offset.y,
        },
        selected: true,
      };
    });

    const newEdges: CanvasEdge[] = copiedEdges
      .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
      .map((edge) => ({
        ...edge,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        source: idMap.get(edge.source)!,
        target: idMap.get(edge.target)!,
        selected: false,
      }));

    useCanvasStore.setState((state) => ({
      nodes: [
        ...state.nodes.map((n) => ({ ...n, selected: false })),
        ...newNodes,
      ],
      edges: [...state.edges, ...newEdges],
      selectedNodeIds: newNodes.map((n) => n.id),
      selectedEdgeIds: [],
      isDirty: true,
    }));
  }, []);

  return { copySelected, paste };
}
