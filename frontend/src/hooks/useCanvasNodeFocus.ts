"use client";

import { useCallback, useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import { useCanvasStore } from "@/stores/canvas";
import { useAnnounce } from "@/components/a11y";

export function useCanvasNodeFocus(onNodeFocus?: (nodeId: string) => void): {
  focusedNodeId: string | null;
  navigateToNode: (direction: "next" | "previous") => void;
  navigateToEdge: (edge: "first" | "last") => void;
} {
  const { announce } = useAnnounce();
  const reactFlow = useReactFlow();
  const nodes = useCanvasStore((s) => s.nodes);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const setSelection = useCanvasStore((s) => s.setSelection);
  const focusIndexRef = useRef<number>(-1);

  const getFocusable = useCallback(
    () =>
      [...nodes]
        .filter((n) => n.type !== "boundary")
        .sort((a, b) =>
          Math.abs(a.position.y - b.position.y) < 50
            ? a.position.x - b.position.x
            : a.position.y - b.position.y,
        ),
    [nodes],
  );

  const focusNode = useCallback(
    (targetNode: Node, label: string) => {
      setSelection([targetNode.id], []);
      reactFlow.setCenter(
        targetNode.position.x + (targetNode.measured?.width ?? 100) / 2,
        targetNode.position.y + (targetNode.measured?.height ?? 50) / 2,
        { duration: 200 },
      );
      announce(label);
      onNodeFocus?.(targetNode.id);
    },
    [setSelection, reactFlow, announce, onNodeFocus],
  );

  const navigateToNode = useCallback(
    (direction: "next" | "previous") => {
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const cur = focusIndexRef.current;
      const newIndex =
        cur < 0
          ? direction === "next"
            ? 0
            : focusable.length - 1
          : direction === "next"
            ? (cur + 1) % focusable.length
            : (cur - 1 + focusable.length) % focusable.length;
      focusIndexRef.current = newIndex;
      const node = focusable[newIndex];
      const d = node.data as { label?: string; componentType?: string };
      focusNode(
        node,
        `${d?.label ?? d?.componentType ?? "Component"}, ${newIndex + 1} of ${focusable.length}`,
      );
    },
    [getFocusable, focusNode],
  );

  const navigateToEdge = useCallback(
    (edge: "first" | "last") => {
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const newIndex = edge === "first" ? 0 : focusable.length - 1;
      focusIndexRef.current = newIndex;
      const node = focusable[newIndex];
      const d = node.data as { label?: string; componentType?: string };
      focusNode(
        node,
        `${d?.label ?? d?.componentType ?? "Component"}, ${edge} node`,
      );
    },
    [getFocusable, focusNode],
  );

  useEffect(() => {
    if (selectedNodeIds.length === 1) {
      const idx = getFocusable().findIndex((n) => n.id === selectedNodeIds[0]);
      if (idx >= 0) focusIndexRef.current = idx;
    }
  }, [selectedNodeIds, getFocusable]);

  const focusedNodeId =
    selectedNodeIds.length === 1
      ? selectedNodeIds[0]
      : focusIndexRef.current >= 0
        ? (getFocusable()[focusIndexRef.current]?.id ?? null)
        : null;

  return { focusedNodeId, navigateToNode, navigateToEdge };
}
