/**
 * Boundary/grouping actions for the canvas store.
 */
import type { CanvasNode, BoundaryActions, SetState, GetState } from "../types";
import {
  adoptContainedNodes,
  fitBoundaryToChildren,
  resolveContainingBoundary,
  getAbsolutePosition,
  sortParentsFirst,
  toRelativePosition,
} from "../geometry";

export const createBoundarySlice = (
  set: SetState,
  get: GetState,
): BoundaryActions => ({
  updateNodeParent: (nodeId: string, parentId: string | null) => {
    set(
      (state) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (!node) return state;
        if ((node.parentId ?? null) === parentId) return state;

        // Re-express the node's position in the new parent's frame without
        // moving it on screen. Frames are resolved through the whole parent
        // chain so this is correct for boundaries nested inside boundaries.
        const absolute = getAbsolutePosition(node, state.nodes);
        const newPosition = toRelativePosition(absolute, parentId, state.nodes);

        // No `extent: "parent"` — that clamps the child inside the boundary
        // so it can never be dragged OUT (UC-19: dragging out clears the
        // parent). Containment is enforced on drop by useBoundaryGrouping.
        // Parents must precede children for React Flow, hence the re-sort.
        const next = state.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                parentId: parentId ?? undefined,
                position: newPosition,
                extent: undefined,
              }
            : n,
        );
        // Re-sort only when parent order actually changed — a fresh array on
        // every reparent re-rendered every boundary and edge for nothing.
        const sorted = sortParentsFirst(next);
        const reordered = sorted.some((n, i) => n !== next[i]);
        return { nodes: reordered ? sorted : next, isDirty: true };
      },
      false,
      "updateNodeParent",
    );
  },

  adoptContainedNodes: (boundaryId: string) => {
    set(
      (state) => {
        const adopted = adoptContainedNodes(state.nodes, boundaryId);
        const nodes = fitBoundaryToChildren(adopted, boundaryId);
        if (nodes === state.nodes) return state;
        return { nodes, isDirty: true };
      },
      false,
      "adoptContainedNodes",
    );
  },

  settleContainment: (nodeId, relativePosition) => {
    const before = get().nodes;
    const node = before.find((n) => n.id === nodeId);
    if (!node) return;

    if (node.type === "boundary") get().adoptContainedNodes(nodeId);

    const nodes = get().nodes;
    const current = nodes.find((n) => n.id === nodeId);
    if (!current) return;
    const absolute = getAbsolutePosition(current, nodes, relativePosition);
    const containing = resolveContainingBoundary(current, absolute, nodes);
    const parent = current.parentId ?? null;

    if (containing !== parent) {
      get().updateNodeParent(nodeId, containing);
      if (containing) get().fitBoundaryToChildren(containing);
    } else if (parent) {
      // Moved within its zone — keep it fully inside.
      get().fitBoundaryToChildren(parent);
    }
  },

  fitBoundaryToChildren: (boundaryId: string) => {
    set(
      (state) => {
        const nodes = fitBoundaryToChildren(state.nodes, boundaryId);
        if (nodes === state.nodes) return state;
        return { nodes, isDirty: true };
      },
      false,
      "fitBoundaryToChildren",
    );
  },

  updateBoundarySize: (boundaryId: string, width: number, height: number) => {
    set(
      (state) => ({
        nodes: state.nodes.map((node) =>
          node.id === boundaryId
            ? {
                ...node,
                style: {
                  ...node.style,
                  width,
                  height,
                },
              }
            : node,
        ),
        isDirty: true,
      }),
      false,
      "updateBoundarySize",
    );
  },

  getBoundaryChildren: (boundaryId: string): CanvasNode[] => {
    return get().nodes.filter((n) => n.parentId === boundaryId);
  },
});
