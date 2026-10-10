"use client";

import { useCallback, useMemo } from "react";
import { useCanvasStore } from "@/stores/canvas";
import { useCanvasWithHistory } from "@/hooks/useCanvasWithHistory";
import {
  BOUNDARY_HEADER_HEIGHT,
  BOUNDARY_INNER_PAD,
  getAbsolutePosition,
} from "@/stores/canvas/geometry";

interface UseBoundaryActionsReturn {
  createBoundaryFromSelection: () => string | null;
  ungroupBoundary: (boundaryId: string) => void;
  getNestingDepth: (boundaryId: string) => number;
  canCreateFromSelection: boolean;
}

export function useBoundaryActions(): UseBoundaryActionsReturn {
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNodeParent = useCanvasStore((s) => s.updateNodeParent);
  const deleteSelected = useCanvasStore((s) => s.deleteSelected);
  const setSelection = useCanvasStore((s) => s.setSelection);
  const { addBoundary } = useCanvasWithHistory();

  const canCreateFromSelection = useMemo(() => {
    if (selectedNodeIds.length < 2) return false;

    const selectedNodes = nodes.filter((node) =>
      selectedNodeIds.includes(node.id),
    );
    return !selectedNodes.some((node) => node.type === "boundary");
  }, [selectedNodeIds, nodes]);

  const createBoundaryFromSelection = useCallback(() => {
    if (!canCreateFromSelection) return null;

    const selectedNodes = nodes.filter((node) =>
      selectedNodeIds.includes(node.id),
    );

    // Bounding box in ABSOLUTE coordinates (selected nodes may already be
    // inside other boundaries) using rendered sizes.
    let minX = Infinity,
      minY = Infinity;
    for (const node of selectedNodes) {
      const abs = getAbsolutePosition(node, nodes);
      minX = Math.min(minX, abs.x);
      minY = Math.min(minY, abs.y);
    }

    // Origin leaves room for the header and the inner clearance; the size is
    // then fitted to the children once they are parented.
    const boundaryId = addBoundary({
      x: minX - BOUNDARY_INNER_PAD,
      y: minY - BOUNDARY_HEADER_HEIGHT - BOUNDARY_INNER_PAD,
    });

    for (const node of selectedNodes) {
      updateNodeParent(node.id, boundaryId);
    }
    useCanvasStore.getState().fitBoundaryToChildren(boundaryId);

    return boundaryId;
  }, [
    canCreateFromSelection,
    selectedNodeIds,
    nodes,
    addBoundary,
    updateNodeParent,
  ]);

  const ungroupBoundary = useCallback(
    (boundaryId: string) => {
      const boundary = nodes.find((node) => node.id === boundaryId);
      if (!boundary || boundary.type !== "boundary") return;

      // Set all children's parent to null
      const childNodes = nodes.filter((node) => node.parentId === boundaryId);
      for (const child of childNodes) {
        updateNodeParent(child.id, null);
      }

      // Select and delete the boundary
      setSelection([boundaryId], []);
      deleteSelected();
    },
    [nodes, updateNodeParent, setSelection, deleteSelected],
  );

  const getNestingDepth = useCallback(
    (boundaryId: string): number => {
      let depth = 0;
      let currentId = boundaryId;

      while (currentId) {
        const node = nodes.find((n) => n.id === currentId);
        if (!node || node.type !== "boundary") break;

        if (node.parentId) {
          depth++;
          currentId = node.parentId;
        } else {
          break;
        }
      }

      return depth;
    },
    [nodes],
  );

  return {
    createBoundaryFromSelection,
    ungroupBoundary,
    getNestingDepth,
    canCreateFromSelection,
  };
}
