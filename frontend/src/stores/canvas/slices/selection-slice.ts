/**
 * Selection and clipboard actions for the canvas store.
 */
import { getAbsolutePosition } from "../geometry";
import type {
  CanvasNode,
  CanvasEdge,
  SelectionActions,
  SetState,
  GetState,
} from "../types";
import { generateId } from "../types";

export const createSelectionSlice = (
  set: SetState,
  get: GetState,
): SelectionActions => ({
  deleteSelected: () => {
    const { selectedNodeIds, selectedEdgeIds } = get();
    set(
      (state) => ({
        // Children of a deleted boundary are kept, moved to the top level at
        // the absolute position they were at (a missing parent would make
        // React Flow drop them and reload them at the wrong place).
        nodes: state.nodes
          .filter((n) => !selectedNodeIds.includes(n.id))
          .map((n) =>
            n.parentId && selectedNodeIds.includes(n.parentId)
              ? {
                  ...n,
                  parentId: undefined,
                  extent: undefined,
                  position: getAbsolutePosition(n, state.nodes),
                }
              : n,
          ),
        edges: state.edges.filter(
          (e) =>
            !selectedEdgeIds.includes(e.id) &&
            !selectedNodeIds.includes(e.source) &&
            !selectedNodeIds.includes(e.target),
        ),
        selectedNodeIds: [],
        selectedEdgeIds: [],
        isDirty: true,
      }),
      false,
      "deleteSelected",
    );
  },

  setSelection: (nodeIds: string[], edgeIds: string[]) => {
    set(
      { selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds },
      false,
      "setSelection",
    );
  },

  setHoveredNodeId: (id: string | null) => {
    set({ hoveredNodeId: id }, false, "setHoveredNodeId");
  },

  duplicateSelected: () => {
    const { selectedNodeIds, nodes, edges } = get();
    if (selectedNodeIds.length === 0) return;

    const idMap = new Map<string, string>();
    const newNodes: CanvasNode[] = [];
    const newEdges: CanvasEdge[] = [];

    // Duplicate selected nodes with offset
    selectedNodeIds.forEach((nodeId) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const newId = generateId();
      idMap.set(nodeId, newId);

      newNodes.push({
        ...node,
        id: newId,
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
        selected: true,
      });
    });

    // Duplicate edges between selected nodes
    edges.forEach((edge) => {
      if (idMap.has(edge.source) && idMap.has(edge.target)) {
        newEdges.push({
          ...edge,
          id: generateId(),
          source: idMap.get(edge.source)!,
          target: idMap.get(edge.target)!,
        });
      }
    });

    set(
      (state) => ({
        nodes: [
          ...state.nodes.map((n) => ({ ...n, selected: false })),
          ...newNodes,
        ],
        edges: [...state.edges, ...newEdges],
        selectedNodeIds: newNodes.map((n) => n.id),
        isDirty: true,
      }),
      false,
      "duplicateSelected",
    );
  },
});
