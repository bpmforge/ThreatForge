/**
 * useFormatPainter - Lucidchart-style format painter for copying node styles.
 *
 * Activate from the toolbar to copy the selected node's style, then click
 * any other node to paste it. ESC or clicking canvas background cancels.
 */
import { useCallback, useEffect, useRef } from "react";
import { useCanvasStore } from "@/stores/canvas";
import { useUIStore } from "@/stores/ui-store";
import { useHistoryStore, createSnapshot } from "@/stores/history-store";
import type { ComponentStyle } from "@/types/canvas";

// Module-level ref so copied style survives re-renders and hook calls
const copiedStyleRef = { current: null as ComponentStyle | null };

export function useFormatPainter() {
  const isFormatPainting = useUIStore((s) => s.isFormatPainting);
  const setIsFormatPainting = useUIStore((s) => s.setIsFormatPainting);
  const activeNodeIdRef = useRef<string | null>(null);

  /** Copy style from a node and enter painting mode */
  const activate = useCallback(
    (nodeId: string) => {
      const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const data = node.data as { style?: ComponentStyle };
      copiedStyleRef.current = data.style ? { ...data.style } : {};
      activeNodeIdRef.current = nodeId;
      setIsFormatPainting(true);
    },
    [setIsFormatPainting],
  );

  /** Paste copied style onto a target node */
  const pasteStyle = useCallback(
    (targetNodeId: string) => {
      if (!copiedStyleRef.current) return;
      if (targetNodeId === activeNodeIdRef.current) {
        // Clicking source node again cancels painter mode
        setIsFormatPainting(false);
        return;
      }
      const { nodes, edges } = useCanvasStore.getState();
      useHistoryStore
        .getState()
        .push(createSnapshot(nodes, edges), "Paste Style");
      useCanvasStore.getState().updateNodeData(targetNodeId, {
        style: { ...copiedStyleRef.current },
      });
      setIsFormatPainting(false);
    },
    [setIsFormatPainting],
  );

  /** Cancel painter mode without pasting */
  const cancel = useCallback(() => {
    setIsFormatPainting(false);
    copiedStyleRef.current = null;
    activeNodeIdRef.current = null;
  }, [setIsFormatPainting]);

  // ESC key cancels painter mode
  useEffect(() => {
    if (!isFormatPainting) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFormatPainting, cancel]);

  return { isFormatPainting, activate, pasteStyle, cancel };
}
