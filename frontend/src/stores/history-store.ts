/**
 * History store for undo/redo functionality.
 *
 * Implements the Command pattern to track canvas state changes.
 * Stores snapshots of nodes and edges for efficient undo/redo.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Node, Edge } from "@xyflow/react";
import type {
  ComponentNodeData,
  BoundaryNodeData,
  LegendNodeData,
  ConnectionData,
} from "@/types/canvas";

/** Canvas snapshot for history — covers every node kind the canvas can hold. */
export type HistoryNodeData =
  | ComponentNodeData
  | BoundaryNodeData
  | LegendNodeData;
export interface CanvasSnapshot {
  nodes: Node<HistoryNodeData>[];
  edges: Edge<ConnectionData>[];
  timestamp: number;
}

/** History entry with action name */
interface HistoryEntry {
  snapshot: CanvasSnapshot;
  actionName: string;
}

interface HistoryState {
  /** Past states (for undo) */
  past: HistoryEntry[];
  /** Future states (for redo) */
  future: HistoryEntry[];
  /** Maximum history size */
  maxSize: number;
  /** Whether currently in a batch operation */
  isBatching: boolean;
  /** Pending batch snapshot */
  batchStart: CanvasSnapshot | null;
}

interface HistoryActions {
  /** Push a new snapshot to history */
  push: (snapshot: CanvasSnapshot, actionName: string) => void;
  /** Undo the last action, returns the previous snapshot */
  undo: (currentSnapshot: CanvasSnapshot) => CanvasSnapshot | null;
  /** Redo the last undone action, returns the next snapshot */
  redo: (currentSnapshot: CanvasSnapshot) => CanvasSnapshot | null;
  /** Start a batch operation (multiple changes as one undo step) */
  startBatch: (snapshot: CanvasSnapshot) => void;
  /** End batch and commit as single action */
  endBatch: (snapshot: CanvasSnapshot, actionName: string) => void;
  /** Cancel batch without committing */
  cancelBatch: () => void;
  /** Clear all history */
  clear: () => void;
  /** Check if undo is available */
  canUndo: () => boolean;
  /** Check if redo is available */
  canRedo: () => boolean;
  /** Get history sizes for UI */
  getHistoryInfo: () => { undoCount: number; redoCount: number };
}

type HistoryStore = HistoryState & HistoryActions;

/** Default max history size */
const DEFAULT_MAX_SIZE = 50;

export const useHistoryStore = create<HistoryStore>()(
  devtools(
    (set, get) => ({
      past: [],
      future: [],
      maxSize: DEFAULT_MAX_SIZE,
      isBatching: false,
      batchStart: null,

      push: (snapshot, actionName) => {
        const { isBatching, maxSize } = get();

        // Don't push during batch - wait for endBatch
        if (isBatching) return;

        const entry: HistoryEntry = { snapshot, actionName };

        set(
          (state) => {
            const newPast = [...state.past, entry];
            // Trim to max size
            if (newPast.length > maxSize) {
              newPast.shift();
            }
            return {
              past: newPast,
              // Clear future on new action (standard undo/redo behavior)
              future: [],
            };
          },
          false,
          "history/push",
        );
      },

      undo: (currentSnapshot) => {
        const { past } = get();
        if (past.length === 0) return null;

        const previous = past[past.length - 1];

        set(
          (state) => ({
            past: state.past.slice(0, -1),
            future: [
              { snapshot: currentSnapshot, actionName: previous.actionName },
              ...state.future,
            ],
          }),
          false,
          "history/undo",
        );

        return previous.snapshot;
      },

      redo: (currentSnapshot) => {
        const { future } = get();
        if (future.length === 0) return null;

        const next = future[0];

        set(
          (state) => ({
            past: [
              ...state.past,
              { snapshot: currentSnapshot, actionName: next.actionName },
            ],
            future: state.future.slice(1),
          }),
          false,
          "history/redo",
        );

        return next.snapshot;
      },

      startBatch: (snapshot) => {
        set(
          { isBatching: true, batchStart: snapshot },
          false,
          "history/startBatch",
        );
      },

      endBatch: (snapshot, actionName) => {
        const { batchStart, maxSize } = get();
        if (!batchStart) return;

        // Only push if there were actual changes
        const hasChanges =
          JSON.stringify(batchStart) !== JSON.stringify(snapshot);

        if (hasChanges) {
          const entry: HistoryEntry = { snapshot: batchStart, actionName };

          set(
            (state) => {
              const newPast = [...state.past, entry];
              if (newPast.length > maxSize) {
                newPast.shift();
              }
              return {
                past: newPast,
                future: [],
                isBatching: false,
                batchStart: null,
              };
            },
            false,
            "history/endBatch",
          );
        } else {
          set(
            { isBatching: false, batchStart: null },
            false,
            "history/endBatch",
          );
        }
      },

      cancelBatch: () => {
        set(
          { isBatching: false, batchStart: null },
          false,
          "history/cancelBatch",
        );
      },

      clear: () => {
        set(
          { past: [], future: [], isBatching: false, batchStart: null },
          false,
          "history/clear",
        );
      },

      canUndo: () => get().past.length > 0,

      canRedo: () => get().future.length > 0,

      getHistoryInfo: () => ({
        undoCount: get().past.length,
        redoCount: get().future.length,
      }),
    }),
    { name: "HistoryStore" },
  ),
);

/** Create a snapshot from current canvas state */
export function createSnapshot(
  nodes: Node<HistoryNodeData>[],
  edges: Edge<ConnectionData>[],
): CanvasSnapshot {
  return {
    // Deep clone to avoid reference issues — structuredClone is faster than
    // JSON.parse/stringify and avoids intermediate string allocation
    nodes: structuredClone(nodes),
    edges: structuredClone(edges),
    timestamp: Date.now(),
  };
}
