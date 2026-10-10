"use client";

/**
 * useBoundaryDragFeedback - Track node drag state for boundary highlighting.
 *
 * Determines which boundary (if any) a node is being dragged over,
 * providing visual feedback for drag-and-drop grouping. Uses the same
 * absolute-frame, innermost-wins resolution as the drop itself, so the
 * highlight always matches where the node will actually land.
 */
import { useState, useCallback, useRef } from "react";
import { useCanvasStore } from "@/stores/canvas";
import {
  findInnermostBoundary,
  getAbsolutePosition,
  getBoundaryRects,
  getDescendantIds,
  getNodeSize,
} from "@/stores/canvas/geometry";

interface BoundaryBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseBoundaryDragFeedbackReturn {
  /** Whether a node is currently being dragged */
  isDragging: boolean;
  /** ID of the boundary the node is being dragged over */
  targetBoundaryId: string | null;
  /** Bounds of the target boundary for visual feedback */
  targetBoundaryBounds: BoundaryBounds | null;
  /** Call when node drag starts */
  onNodeDragStart: (nodeId: string) => void;
  /** Call during node drag with current (parent-relative) position */
  onNodeDrag: (nodeId: string, position: { x: number; y: number }) => void;
  /** Call when node drag stops */
  onNodeDragStop: () => void;
}

export function useBoundaryDragFeedback(): UseBoundaryDragFeedbackReturn {
  const [isDragging, setIsDragging] = useState(false);
  const [targetBoundaryId, setTargetBoundaryId] = useState<string | null>(null);
  const [targetBoundaryBounds, setTargetBoundaryBounds] =
    useState<BoundaryBounds | null>(null);

  const draggingNodeIdRef = useRef<string | null>(null);

  const onNodeDragStart = useCallback((nodeId: string) => {
    draggingNodeIdRef.current = nodeId;
    setIsDragging(true);
  }, []);

  const onNodeDrag = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      if (draggingNodeIdRef.current !== nodeId) return;

      const nodes = useCanvasStore.getState().nodes;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const { width, height } = getNodeSize(node);
      const abs = getAbsolutePosition(node, nodes, position);
      const center = { x: abs.x + width / 2, y: abs.y + height / 2 };

      // Never highlight the node itself / its descendants, or the boundary it
      // already lives in (nothing would change on drop).
      const exclude = getDescendantIds(nodeId, nodes);
      if (node.parentId) exclude.add(node.parentId);
      const candidates = getBoundaryRects(nodes).filter(
        (b) => b.width * b.height > width * height,
      );
      const boundary = findInnermostBoundary(center, candidates, exclude);

      setTargetBoundaryId(boundary?.id ?? null);
      setTargetBoundaryBounds(boundary);
    },
    [],
  );

  const onNodeDragStop = useCallback(() => {
    draggingNodeIdRef.current = null;
    setIsDragging(false);
    setTargetBoundaryId(null);
    setTargetBoundaryBounds(null);
  }, []);

  return {
    isDragging,
    targetBoundaryId,
    targetBoundaryBounds,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
  };
}
