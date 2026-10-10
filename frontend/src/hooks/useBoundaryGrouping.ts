/**
 * useBoundaryGrouping - Hook for managing node grouping within boundaries.
 *
 * Detects when nodes are dragged into or out of boundary nodes, automatically
 * updating parent-child relationships and growing boundaries to fit.
 *
 * Every containment decision is made in ABSOLUTE canvas coordinates
 * (see stores/canvas/geometry). React Flow hands us positions relative to the
 * parent for nested nodes, and boundaries can themselves be nested, so mixing
 * frames here is what previously made nested boundaries mis-detect.
 *
 * Store reads go through `useCanvasStore.getState()` at call time: the
 * auto-resize used to run in a `setTimeout` over the render-time `nodes`
 * closure, which predated the reparent — so the new child was invisible to it
 * and the boundary collapsed to its MINIMUM size instead of growing.
 */
import { useCallback, useRef } from "react";
import { type NodeChange } from "@xyflow/react";
import { useCanvasStore, type CanvasNode } from "@/stores/canvas";
import {
  BOUNDARY_INNER_PAD,
  MIN_BOUNDARY_HEIGHT,
  MIN_BOUNDARY_WIDTH,
  getDescendantIds,
  rectContainsPoint,
  resolveContainingBoundary,
} from "@/stores/canvas/geometry";

/** Clearance between a child and the boundary's interior edge. */
export const BOUNDARY_PADDING = BOUNDARY_INNER_PAD;
export { MIN_BOUNDARY_WIDTH, MIN_BOUNDARY_HEIGHT };

export interface BoundaryBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Check if a point is inside a boundary
 */
export function isPointInBoundary(
  point: { x: number; y: number },
  boundary: BoundaryBounds,
): boolean {
  return rectContainsPoint(boundary, point);
}

/**
 * Check if a node is inside a boundary (using center point)
 */
export function isNodeInBoundary(
  node: { position: { x: number; y: number } },
  boundary: BoundaryBounds,
  nodeWidth = 160,
  nodeHeight = 60,
): boolean {
  const centerX = node.position.x + nodeWidth / 2;
  const centerY = node.position.y + nodeHeight / 2;
  return isPointInBoundary({ x: centerX, y: centerY }, boundary);
}

/**
 * Get the bounding box for a set of child nodes
 */
export function getChildrenBounds(
  children: Array<{ position: { x: number; y: number } }>,
  nodeWidth = 160,
  nodeHeight = 60,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (children.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  children.forEach((child) => {
    minX = Math.min(minX, child.position.x);
    minY = Math.min(minY, child.position.y);
    maxX = Math.max(maxX, child.position.x + nodeWidth);
    maxY = Math.max(maxY, child.position.y + nodeHeight);
  });

  return { minX, minY, maxX, maxY };
}

export { resolveContainingBoundary };

interface UseBoundaryGroupingReturn {
  /** Process node changes to update grouping */
  processNodeChanges: (changes: NodeChange<CanvasNode>[]) => void;
  /** Manually assign a node to a boundary */
  assignToBoundary: (nodeId: string, boundaryId: string | null) => void;
  /** Get children of a boundary */
  getBoundaryChildren: (boundaryId: string) => CanvasNode[];
  /** Auto-resize a boundary to fit its children */
  autoResizeBoundary: (boundaryId: string) => void;
}

export function useBoundaryGrouping(): UseBoundaryGroupingReturn {
  const updateNodeParent = useCanvasStore((s) => s.updateNodeParent);

  // Track nodes being dragged
  const draggingNodesRef = useRef<Set<string>>(new Set());

  const getBoundaryChildren = useCallback(
    (boundaryId: string): CanvasNode[] =>
      useCanvasStore.getState().nodes.filter((n) => n.parentId === boundaryId),
    [],
  );

  /**
   * Grow a boundary so every child is fully inside with clearance (see
   * geometry.fitBoundaryToChildren). Reads the LIVE store so it sees a
   * reparent that happened a moment ago. Expand only — never shrinks a
   * boundary the user sized by hand.
   */
  const autoResizeBoundary = useCallback(
    (boundaryId: string) =>
      useCanvasStore.getState().fitBoundaryToChildren(boundaryId),
    [],
  );

  /**
   * Process node changes to detect drag-into / drag-out-of boundary
   */
  const processNodeChanges = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      changes.forEach((change) => {
        if (change.type !== "position") return;
        const nodeId = change.id;

        if (change.dragging) {
          draggingNodesRef.current.add(nodeId);
          return;
        }
        if (!draggingNodesRef.current.has(nodeId)) return;
        draggingNodesRef.current.delete(nodeId);

        // Drag ended — the store resolves containment (adoption for a moved
        // boundary, innermost-zone parenting, 10px fit) from its CURRENT
        // state, in absolute coordinates. Shared with palette drops.
        useCanvasStore.getState().settleContainment(nodeId, change.position);
      });
    },
    [],
  );

  /**
   * Manually assign a node to a boundary
   */
  const assignToBoundary = useCallback(
    (nodeId: string, boundaryId: string | null) => {
      const nodes = useCanvasStore.getState().nodes;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      if (boundaryId && getDescendantIds(nodeId, nodes).has(boundaryId)) return;

      const currentParent = node.parentId ?? null;
      if (currentParent === boundaryId) return;

      updateNodeParent(nodeId, boundaryId);
      if (boundaryId) autoResizeBoundary(boundaryId);
    },
    [updateNodeParent, autoResizeBoundary],
  );

  return {
    processNodeChanges,
    assignToBoundary,
    getBoundaryChildren,
    autoResizeBoundary,
  };
}
