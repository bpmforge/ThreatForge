"use client";

/**
 * useHopHighlight
 *
 * Reuses the attack-paths canvas-highlight mechanism — the `chainHighlight`
 * field on ComponentNode data, applied via `useCanvasStore.updateNodeData`
 * (the same primitive AttackChainOverlay uses for whole-chain highlighting).
 *
 * This hook scopes the highlight to a SINGLE hop so that hovering a hop in the
 * panel rings just that component on the canvas. Hover-out (or unmount) clears
 * it, so it composes cleanly with the whole-chain overlay.
 */
import { useCallback, useEffect, useRef } from "react";
import { useCanvasStore } from "@/stores/canvas";
import type { AttackChainHop } from "../types";

export function useHopHighlight() {
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const highlightedRef = useRef<string | null>(null);

  const clear = useCallback(() => {
    const id = highlightedRef.current;
    if (id) {
      updateNodeData(id, { chainHighlight: undefined });
      highlightedRef.current = null;
    }
  }, [updateNodeData]);

  const highlightHop = useCallback(
    (hop: AttackChainHop) => {
      const match = nodes.find(
        (n) => n.id === hop.componentId || n.data.label === hop.componentName,
      );
      if (!match) return;
      if (highlightedRef.current && highlightedRef.current !== match.id) {
        clear();
      }
      highlightedRef.current = match.id;
      updateNodeData(match.id, { chainHighlight: "intermediate" });
    },
    [nodes, updateNodeData, clear],
  );

  // Clear any lingering highlight on unmount.
  useEffect(() => clear, [clear]);

  return { highlightHop, clearHop: clear };
}
