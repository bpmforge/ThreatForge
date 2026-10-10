/**
 * useArrowNudge - Lucidchart-style arrow key nudging for canvas nodes.
 *
 * Arrow keys move selected nodes 8px; Shift+Arrow moves 1px (fine adjust).
 * Multiple rapid presses coalesce into a single undo entry via debouncing.
 */
import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/stores/canvas";
import { useHistoryStore, createSnapshot } from "@/stores/history-store";

const NUDGE_STEP = 8;
const NUDGE_STEP_FINE = 1;
const HISTORY_DEBOUNCE_MS = 500;

export function useArrowNudge() {
  // true while a nudge gesture is in progress (history snapshot already taken)
  const gestureActiveRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      const arrowKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (!arrowKeys.includes(e.key)) return;

      const { selectedNodeIds, nodes } = useCanvasStore.getState();
      if (selectedNodeIds.length === 0) return;

      // Don't nudge locked nodes
      const hasLocked = selectedNodeIds.some((id) => {
        const node = nodes.find((n) => n.id === id);
        return node?.data?.locked;
      });
      if (hasLocked) return;

      e.preventDefault();

      const step = e.shiftKey ? NUDGE_STEP_FINE : NUDGE_STEP;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else if (e.key === "ArrowLeft") dx = -step;
      else dx = step;

      // Snapshot before the first key in a gesture, not on every key
      if (!gestureActiveRef.current) {
        gestureActiveRef.current = true;
        const { nodes: n, edges: e2 } = useCanvasStore.getState();
        useHistoryStore.getState().push(createSnapshot(n, e2), "Nudge");
      }

      // Apply movement
      useCanvasStore.setState((state) => ({
        nodes: state.nodes.map((n) =>
          state.selectedNodeIds.includes(n.id)
            ? {
                ...n,
                position: { x: n.position.x + dx, y: n.position.y + dy },
              }
            : n,
        ),
        isDirty: true,
      }));

      // Reset debounce — next key after pause starts a new gesture + history entry
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        gestureActiveRef.current = false;
        timerRef.current = null;
      }, HISTORY_DEBOUNCE_MS);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
