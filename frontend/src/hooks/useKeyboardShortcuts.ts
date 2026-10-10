import { useCallback, useEffect, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useCanvasStore } from "@/stores/canvas";
import { useCanvasWithHistory } from "./useCanvasWithHistory";
import { useUndoRedo } from "./useUndoRedo";
import { useClipboardOperations } from "./useClipboardOperations";
import type {
  UseKeyboardShortcutsOptions,
  UseKeyboardShortcutsReturn,
} from "./keyboard-shortcuts-config";

export type {
  ShortcutDefinition,
  UseKeyboardShortcutsOptions,
  UseKeyboardShortcutsReturn,
} from "./keyboard-shortcuts-config";
export { SHORTCUTS } from "./keyboard-shortcuts-config";

export function useKeyboardShortcuts(
  options: UseKeyboardShortcutsOptions = {},
): UseKeyboardShortcutsReturn {
  const {
    enabled = true,
    onShowHelp,
    onEscape,
    onToggleGrid,
    onToggleSnap,
    onToggleMinimap,
    onOpenFind,
    onToggleOutline,
  } = options;

  const [isPanMode, setIsPanMode] = useState(false);

  const reactFlow = useReactFlow();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const setSelection = useCanvasStore((s) => s.setSelection);

  const { deleteSelected, duplicateSelected } = useCanvasWithHistory();
  const { undo, redo } = useUndoRedo({ enableShortcuts: false });
  const { copySelected, paste } = useClipboardOperations();

  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  const showHelp = useCallback(() => onShowHelp?.(), [onShowHelp]);

  const selectAll = useCallback(() => {
    setSelection(
      nodes.map((n) => n.id),
      edges.map((e) => e.id),
    );
  }, [nodes, edges, setSelection]);

  const deselectAll = useCallback(() => {
    setSelection([], []);
    onEscape?.();
  }, [setSelection, onEscape]);

  const zoomIn = useCallback(
    () => reactFlow.zoomIn({ duration: 200 }),
    [reactFlow],
  );
  const zoomOut = useCallback(
    () => reactFlow.zoomOut({ duration: 200 }),
    [reactFlow],
  );
  const fitView = useCallback(
    () => reactFlow.fitView({ duration: 300, padding: 0.2 }),
    [reactFlow],
  );

  const fitSelection = useCallback(() => {
    if (selectedNodeIds.length === 0) {
      reactFlow.fitView({ duration: 300, padding: 0.2 });
      return;
    }
    reactFlow.fitView({
      nodes: nodes.filter((n) => selectedNodeIds.includes(n.id)),
      duration: 300,
      padding: 0.3,
    });
  }, [reactFlow, nodes, selectedNodeIds]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      const target = e.target as HTMLElement;

      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      if (e.key === " " && !e.repeat) {
        e.preventDefault();
        setIsPanMode(true);
        return;
      }
      // "?" is handled globally by GlobalShortcutsHelp at the app shell
      // level so it works from every page, not only the canvas. The
      // canvas-scoped handler was removed to avoid two dialogs opening.

      if (!modifier && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case "delete":
          case "backspace":
            e.preventDefault();
            deleteSelected();
            return;
          case "escape":
            e.preventDefault();
            deselectAll();
            return;
          case "g":
            e.preventDefault();
            e.shiftKey ? onToggleSnap?.() : onToggleGrid?.();
            return;
          case "m":
            e.preventDefault();
            onToggleMinimap?.();
            return;
        }
      }

      if (modifier) {
        switch (e.key.toLowerCase()) {
          case "z":
            e.preventDefault();
            e.shiftKey ? redo() : undo();
            return;
          case "y":
            if (!isMac) {
              e.preventDefault();
              redo();
            }
            return;
          case "c":
            e.preventDefault();
            copySelected();
            return;
          case "v":
            e.preventDefault();
            paste();
            return;
          case "d":
            e.preventDefault();
            duplicateSelected();
            return;
          case "a":
            e.preventDefault();
            selectAll();
            return;
          case "=":
          case "+":
            e.preventDefault();
            zoomIn();
            return;
          case "-":
            e.preventDefault();
            zoomOut();
            return;
          case "0":
            e.preventDefault();
            fitView();
            return;
          case "f":
            e.preventDefault();
            e.shiftKey ? fitSelection() : onOpenFind?.();
            return;
          case "\\":
            e.preventDefault();
            onToggleOutline?.();
            return;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") setIsPanMode(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    enabled,
    isMac,
    showHelp,
    deleteSelected,
    deselectAll,
    undo,
    redo,
    copySelected,
    paste,
    duplicateSelected,
    selectAll,
    zoomIn,
    zoomOut,
    fitView,
    fitSelection,
    onToggleGrid,
    onToggleSnap,
    onToggleMinimap,
    onOpenFind,
    onToggleOutline,
  ]);

  return { isPanMode, showHelp };
}
