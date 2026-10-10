"use client";

import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { useCanvasStore } from "@/stores/canvas";
import { useAnnounce } from "@/components/a11y";
import { useCanvasNodeFocus } from "./useCanvasNodeFocus";

const MOVE_STEP = 10;
const MOVE_STEP_LARGE = 50;

const ARROW_DELTAS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

interface UseCanvasKeyboardNavOptions {
  enabled?: boolean;
  disableNudge?: boolean;
  onNodeActivate?: (nodeId: string) => void;
  onNodeFocus?: (nodeId: string) => void;
}

export function useCanvasKeyboardNav(
  options: UseCanvasKeyboardNavOptions = {},
) {
  const {
    enabled = true,
    disableNudge = false,
    onNodeActivate,
    onNodeFocus,
  } = options;

  const { announce } = useAnnounce();
  const reactFlow = useReactFlow();
  const nodes = useCanvasStore((s) => s.nodes);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);

  const { focusedNodeId, navigateToNode, navigateToEdge } =
    useCanvasNodeFocus(onNodeFocus);

  const moveSelectedNodes = useCallback(
    (dx: number, dy: number) => {
      if (selectedNodeIds.length === 0) return;
      useCanvasStore.setState({
        nodes: nodes.map((n) =>
          selectedNodeIds.includes(n.id)
            ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
            : n,
        ),
        isDirty: true,
      });
      const dir = dy < 0 ? "up" : dy > 0 ? "down" : dx < 0 ? "left" : "right";
      announce(
        `Moved ${selectedNodeIds.length} node${selectedNodeIds.length > 1 ? "s" : ""} ${dir}`,
      );
    },
    [selectedNodeIds, nodes, announce],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!enabled) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      const step = e.shiftKey ? MOVE_STEP_LARGE : MOVE_STEP;
      const delta = ARROW_DELTAS[e.key];

      if (delta) {
        e.preventDefault();
        const [dx, dy] = delta;
        if (selectedNodeIds.length > 0 && !disableNudge) {
          moveSelectedNodes(dx * step, dy * step);
        } else if (selectedNodeIds.length === 0) {
          const vp = reactFlow.getViewport();
          reactFlow.setViewport({
            ...vp,
            x: vp.x - dx * step * 5,
            y: vp.y - dy * step * 5,
          });
        }
        return;
      }

      switch (e.key) {
        case "Tab":
          e.preventDefault();
          navigateToNode(e.shiftKey ? "previous" : "next");
          break;
        case "Home":
          e.preventDefault();
          navigateToEdge("first");
          break;
        case "End":
          e.preventDefault();
          navigateToEdge("last");
          break;
        case "Enter":
        case " ":
          if (selectedNodeIds.length === 1) {
            e.preventDefault();
            onNodeActivate?.(selectedNodeIds[0]);
            announce("Properties panel opened");
          }
          break;
      }
    },
    [
      enabled,
      disableNudge,
      selectedNodeIds,
      moveSelectedNodes,
      navigateToNode,
      navigateToEdge,
      onNodeActivate,
      reactFlow,
      announce,
    ],
  );

  return { focusedNodeId, handleKeyDown };
}
