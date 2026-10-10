"use client";

/**
 * useCanvasDragHandlers — encapsulates node drag lifecycle callbacks.
 *
 * Handles:
 * - Alt+drag duplicate
 * - Boundary drag feedback (visual highlight)
 * - Smart alignment guides during drag
 * - Overlap prevention after drop
 * - History batching (start on drag-start, commit on drag-stop)
 *
 * Extracted from ThreatModelCanvas to keep the orchestrating component ≤300 lines.
 */

import { useCallback, useRef } from "react";
import { useHistoryStore, createSnapshot } from "@/stores/history-store";
import {
  useCanvasStore,
  type CanvasNode,
  type CanvasEdge,
} from "@/stores/canvas";
import type { OnNodesChange } from "@xyflow/react";

interface UseCanvasDragHandlersOptions {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  onNodesChange: OnNodesChange<CanvasNode>;
  onNodeDragStart: (nodeId: string) => void;
  onNodeDrag: (nodeId: string, position: { x: number; y: number }) => void;
  onNodeDragStop: () => void;
  computeGuides: (
    node: CanvasNode,
    nodes: CanvasNode[],
  ) => { x: number; y: number } | null;
  clearGuides: () => void;
}

export function useCanvasDragHandlers({
  nodes,
  edges,
  onNodesChange,
  onNodeDragStart: boundaryDragStart,
  onNodeDrag: boundaryDrag,
  onNodeDragStop: boundaryDragStop,
  computeGuides,
  clearGuides,
}: UseCanvasDragHandlersOptions) {
  const startBatch = useHistoryStore((s) => s.startBatch);
  const endBatch = useHistoryStore((s) => s.endBatch);

  // Alt+drag state: track original position to restore after duplicating
  const altDragRef = useRef<{
    nodeId: string;
    originalPosition: { x: number; y: number };
  } | null>(null);

  /** Handle node drag start for boundary feedback + history batch */
  const handleNodeDragStart = useCallback(
    (event: React.MouseEvent, node: CanvasNode) => {
      startBatch(createSnapshot(nodes, edges));
      boundaryDragStart(node.id);
      if (event.altKey) {
        altDragRef.current = {
          nodeId: node.id,
          originalPosition: { ...node.position },
        };
      }
    },
    [startBatch, nodes, edges, boundaryDragStart],
  );

  /** Handle node drag for boundary feedback + alignment guides */
  const handleNodeDrag = useCallback(
    (_event: React.MouseEvent, node: CanvasNode) => {
      boundaryDrag(node.id, node.position);
      computeGuides(node, nodes);
    },
    [boundaryDrag, computeGuides, nodes],
  );

  /** Handle node drag stop — alt+drag duplicate + boundary feedback + alignment guides + overlap prevention + history */
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: CanvasNode) => {
      boundaryDragStop();
      clearGuides();

      // Alt+drag: restore original to its starting position; the moved node becomes the copy
      if (altDragRef.current?.nodeId === node.id) {
        const { originalPosition } = altDragRef.current;
        altDragRef.current = null;
        const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        useCanvasStore.setState((state) => ({
          nodes: state.nodes
            .map((n) =>
              n.id === node.id
                ? { ...n, position: originalPosition, selected: false }
                : n,
            )
            .concat([
              { ...node, id: newId, position: node.position, selected: true },
            ]),
          selectedNodeIds: [newId],
          isDirty: true,
        }));
        // Use getState() to read the freshly mutated state (avoids stale closure)
        const s = useCanvasStore.getState();
        endBatch(createSnapshot(s.nodes, s.edges), "Duplicate (Alt+Drag)");
        return;
      }

      // Push component nodes apart if they overlap siblings after a drag.
      // Boundaries / legends still have to END the history batch below —
      // returning early here left `isBatching` stuck and silently dropped
      // every later undo step.
      if (node.type !== "component") {
        const s = useCanvasStore.getState();
        endBatch(createSnapshot(s.nodes, s.edges), "Move");
        return;
      }

      const PAD = 10;
      const nW = node.measured?.width ?? 160;
      const nH = node.measured?.height ?? 60;

      const siblings = nodes.filter(
        (n) =>
          n.id !== node.id &&
          n.type === "component" &&
          n.parentId === node.parentId,
      );

      let pos = { ...node.position };

      for (const sib of siblings) {
        const sW = sib.measured?.width ?? 160;
        const sH = sib.measured?.height ?? 60;

        const overlapX =
          pos.x < sib.position.x + sW + PAD &&
          pos.x + nW > sib.position.x - PAD;
        const overlapY =
          pos.y < sib.position.y + sH + PAD &&
          pos.y + nH > sib.position.y - PAD;

        if (overlapX && overlapY) {
          const pushR = sib.position.x + sW + PAD - pos.x;
          const pushL = pos.x + nW + PAD - sib.position.x;
          const pushD = sib.position.y + sH + PAD - pos.y;
          const pushU = pos.y + nH + PAD - sib.position.y;

          const min = Math.min(pushR, pushL, pushD, pushU);
          if (min === pushR) pos = { ...pos, x: pos.x + pushR };
          else if (min === pushL) pos = { ...pos, x: pos.x - pushL };
          else if (min === pushD) pos = { ...pos, y: pos.y + pushD };
          else pos = { ...pos, y: pos.y - pushU };

          break; // resolve one overlap per drop; re-drop to resolve more
        }
      }

      if (pos.x !== node.position.x || pos.y !== node.position.y) {
        onNodesChange([{ type: "position", id: node.id, position: pos }]);
      }

      // Commit history batch — reads current store state to avoid stale closures
      const s = useCanvasStore.getState();
      endBatch(createSnapshot(s.nodes, s.edges), "Move");
    },
    [boundaryDragStop, clearGuides, nodes, onNodesChange, endBatch],
  );

  return { handleNodeDragStart, handleNodeDrag, handleNodeDragStop };
}
