/**
 * useUndoRedo - Hook for undo/redo functionality on the canvas.
 *
 * Connects the history store with the canvas store to provide
 * undo/redo operations with keyboard shortcuts.
 */
import { useCallback, useEffect, useRef } from "react";
import { useCanvasStore } from "@/stores/canvas";
import { useHistoryStore, createSnapshot } from "@/stores/history-store";

interface UseUndoRedoOptions {
  /** Enable keyboard shortcuts (default: true) */
  enableShortcuts?: boolean;
  /** Enable history tracking (default: true) */
  enabled?: boolean;
}

interface UseUndoRedoReturn {
  /** Execute undo */
  undo: () => void;
  /** Execute redo */
  redo: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Number of undo steps available */
  undoCount: number;
  /** Number of redo steps available */
  redoCount: number;
  /** Record current state before an action */
  recordBeforeAction: (actionName: string) => void;
  /** Clear all history */
  clearHistory: () => void;
}

export function useUndoRedo(
  options: UseUndoRedoOptions = {},
): UseUndoRedoReturn {
  const { enableShortcuts = true, enabled = true } = options;

  // Canvas store
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);

  // History store
  const push = useHistoryStore((s) => s.push);
  const historyUndo = useHistoryStore((s) => s.undo);
  const historyRedo = useHistoryStore((s) => s.redo);
  const canUndoFn = useHistoryStore((s) => s.canUndo);
  const canRedoFn = useHistoryStore((s) => s.canRedo);
  const getHistoryInfo = useHistoryStore((s) => s.getHistoryInfo);
  const clearHistory = useHistoryStore((s) => s.clear);

  // Track last snapshot for debounced actions
  const _lastSnapshotRef = useRef<{
    nodes: typeof nodes;
    edges: typeof edges;
  } | null>(null);
  const _debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Record state before an action
  const recordBeforeAction = useCallback(
    (actionName: string) => {
      if (!enabled) return;

      const snapshot = createSnapshot(nodes, edges);
      push(snapshot, actionName);
    },
    [enabled, nodes, edges, push],
  );

  // Execute undo
  const undo = useCallback(() => {
    if (!enabled) return;

    const currentSnapshot = createSnapshot(nodes, edges);
    const previousSnapshot = historyUndo(currentSnapshot);

    if (previousSnapshot) {
      loadCanvas(previousSnapshot.nodes, previousSnapshot.edges);
      // Mark dirty so auto-save persists the undo'd state (loadCanvas resets it to false)
      useCanvasStore.setState({ isDirty: true });
    }
  }, [enabled, nodes, edges, historyUndo, loadCanvas]);

  // Execute redo
  const redo = useCallback(() => {
    if (!enabled) return;

    const currentSnapshot = createSnapshot(nodes, edges);
    const nextSnapshot = historyRedo(currentSnapshot);

    if (nextSnapshot) {
      loadCanvas(nextSnapshot.nodes, nextSnapshot.edges);
      useCanvasStore.setState({ isDirty: true });
    }
  }, [enabled, nodes, edges, historyRedo, loadCanvas]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!enableShortcuts || !enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl/Cmd + Z (undo) and Ctrl/Cmd + Shift + Z (redo)
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (!modifier) return;

      // Don't trigger in input fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }

      // Also support Ctrl+Y for redo (Windows convention)
      if ((e.key === "y" || e.key === "Y") && !isMac) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableShortcuts, enabled, undo, redo]);

  const { undoCount, redoCount } = getHistoryInfo();

  return {
    undo,
    redo,
    canUndo: canUndoFn(),
    canRedo: canRedoFn(),
    undoCount,
    redoCount,
    recordBeforeAction,
    clearHistory,
  };
}
