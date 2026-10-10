"use client";

/**
 * useCanvasInteractions — groups hover, drop, selection, and cursor callbacks.
 *
 * Extracted from ThreatModelCanvas to keep the orchestrating component ≤300 lines.
 */

import { useCallback, useRef } from "react";
import { useCanvasStore, type CanvasNode } from "@/stores/canvas";
import { useCanvasWithHistory } from "@/hooks/useCanvasWithHistory";
import type { ComponentType } from "@/types/canvas";
import type { OnSelectionChangeParams } from "@xyflow/react";

interface UseCanvasInteractionsOptions {
  screenToFlowPosition: (pos: { x: number; y: number }) => {
    x: number;
    y: number;
  };
  onCursorMove?: (x: number, y: number) => void;
  onCollaborationSelectionChange?: (nodeIds: string[]) => void;
}

interface DragData {
  type: "component" | "boundary";
  componentType?: ComponentType;
}

export function useCanvasInteractions({
  screenToFlowPosition,
  onCursorMove,
  onCollaborationSelectionChange,
}: UseCanvasInteractionsOptions) {
  const setHoveredNodeId = useCanvasStore((s) => s.setHoveredNodeId);
  const setSelection = useCanvasStore((s) => s.setSelection);
  const { addComponent, addBoundary } = useCanvasWithHistory();

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: CanvasNode) => {
      if (node.type !== "component") return;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => setHoveredNodeId(node.id), 80);
    },
    [setHoveredNodeId],
  );

  const handleNodeMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoveredNodeId(null);
  }, [setHoveredNodeId]);

  const handleSelectionChange = useCallback(
    ({
      nodes: selectedNodes,
      edges: selectedEdges,
    }: OnSelectionChangeParams) => {
      const nodeIds = selectedNodes.map((n) => n.id);
      const edgeIds = selectedEdges.map((e) => e.id);
      setSelection(nodeIds, edgeIds);
      onCollaborationSelectionChange?.(nodeIds);
    },
    [setSelection, onCollaborationSelectionChange],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!onCursorMove) return;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      onCursorMove(position.x, position.y);
    },
    [screenToFlowPosition, onCursorMove],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const dataStr = event.dataTransfer.getData("application/json");
      if (!dataStr) return;
      try {
        const data: DragData = JSON.parse(dataStr);
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        // A palette drop lands like a drag-stop: into the zone under it (or
        // adopting what it covers, for a boundary) with the 10px fit.
        if (data.type === "boundary") {
          const id = addBoundary(position);
          useCanvasStore.getState().settleContainment(id);
        } else if (data.type === "component" && data.componentType) {
          const id = addComponent(data.componentType, position);
          useCanvasStore.getState().settleContainment(id);
          window.dispatchEvent(
            new CustomEvent("ftm-component-placed", {
              detail: data.componentType,
            }),
          );
        }
      } catch {
        console.error("Failed to parse drop data");
      }
    },
    [screenToFlowPosition, addComponent, addBoundary],
  );

  return {
    handleNodeMouseEnter,
    handleNodeMouseLeave,
    handleSelectionChange,
    handleMouseMove,
    handleDragOver,
    handleDrop,
  };
}
