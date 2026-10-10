/**
 * useSelectInverse - Ctrl+Shift+A selects all nodes/edges NOT currently selected.
 */
import { useEffect, useCallback } from "react";
import { useCanvasStore } from "@/stores/canvas";

export function useSelectInverse() {
  const selectInverse = useCallback(() => {
    const { nodes, edges, selectedNodeIds, selectedEdgeIds, setSelection } =
      useCanvasStore.getState();
    const invertedNodeIds = nodes
      .filter((n) => !selectedNodeIds.includes(n.id))
      .map((n) => n.id);
    const invertedEdgeIds = edges
      .filter((e) => !selectedEdgeIds.includes(e.id))
      .map((e) => e.id);
    setSelection(invertedNodeIds, invertedEdgeIds);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "A") {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        )
          return;
        e.preventDefault();
        selectInverse();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectInverse]);

  return { selectInverse };
}
