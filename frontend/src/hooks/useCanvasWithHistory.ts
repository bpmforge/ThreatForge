/**
 * useCanvasWithHistory - Canvas store actions with automatic history tracking.
 *
 * Wraps canvas store actions to record state before changes,
 * enabling undo/redo functionality.
 */
import { useCallback } from "react";
import { useCanvasStore } from "@/stores/canvas";
import { useHistoryStore, createSnapshot } from "@/stores/history-store";
import type { ComponentType } from "@/types/canvas";

/**
 * Hook that provides canvas actions with automatic history tracking.
 * Use this instead of directly calling canvas store actions when you
 * want the action to be undoable.
 */
export function useCanvasWithHistory() {
  // Canvas actions
  const storeAddComponent = useCanvasStore((s) => s.addComponent);
  const storeAddBoundary = useCanvasStore((s) => s.addBoundary);
  const storeUpdateNodeData = useCanvasStore((s) => s.updateNodeData);
  const storeUpdateEdgeData = useCanvasStore((s) => s.updateEdgeData);
  const storeDeleteSelected = useCanvasStore((s) => s.deleteSelected);
  const storeDuplicateSelected = useCanvasStore((s) => s.duplicateSelected);
  const storeClearCanvas = useCanvasStore((s) => s.clearCanvas);
  const storeBringToFront = useCanvasStore((s) => s.bringToFront);
  const storeSendToBack = useCanvasStore((s) => s.sendToBack);
  const storeBringForward = useCanvasStore((s) => s.bringForward);
  const storeSendBackward = useCanvasStore((s) => s.sendBackward);

  // History store
  const push = useHistoryStore((s) => s.push);

  /**
   * Record current state before action. Reads the store at call time rather
   * than subscribing to nodes/edges, which re-rendered every host of this
   * hook on every drag frame.
   */
  const recordState = useCallback(
    (actionName: string) => {
      const { nodes, edges } = useCanvasStore.getState();
      push(createSnapshot(nodes, edges), actionName);
    },
    [push],
  );

  // Wrapped actions with history recording

  const addComponent = useCallback(
    (
      type: ComponentType,
      position: { x: number; y: number },
      label?: string,
    ) => {
      recordState("Add Component");
      return storeAddComponent(type, position, label);
    },
    [recordState, storeAddComponent],
  );

  const addBoundary = useCallback(
    (position: { x: number; y: number }, label?: string) => {
      recordState("Add Boundary");
      return storeAddBoundary(position, label);
    },
    [recordState, storeAddBoundary],
  );

  const updateNodeData = useCallback(
    (nodeId: string, data: Parameters<typeof storeUpdateNodeData>[1]) => {
      recordState("Update Node");
      storeUpdateNodeData(nodeId, data);
    },
    [recordState, storeUpdateNodeData],
  );

  const updateEdgeData = useCallback(
    (edgeId: string, data: Parameters<typeof storeUpdateEdgeData>[1]) => {
      recordState("Update Connection");
      storeUpdateEdgeData(edgeId, data);
    },
    [recordState, storeUpdateEdgeData],
  );

  const deleteSelected = useCallback(() => {
    recordState("Delete");
    storeDeleteSelected();
  }, [recordState, storeDeleteSelected]);

  const duplicateSelected = useCallback(() => {
    recordState("Duplicate");
    storeDuplicateSelected();
  }, [recordState, storeDuplicateSelected]);

  const clearCanvas = useCallback(() => {
    recordState("Clear Canvas");
    storeClearCanvas();
  }, [recordState, storeClearCanvas]);

  const bringToFront = useCallback(
    (nodeId: string) => {
      recordState("Bring to Front");
      storeBringToFront(nodeId);
    },
    [recordState, storeBringToFront],
  );

  const sendToBack = useCallback(
    (nodeId: string) => {
      recordState("Send to Back");
      storeSendToBack(nodeId);
    },
    [recordState, storeSendToBack],
  );

  const bringForward = useCallback(
    (nodeId: string) => {
      recordState("Bring Forward");
      storeBringForward(nodeId);
    },
    [recordState, storeBringForward],
  );

  const sendBackward = useCallback(
    (nodeId: string) => {
      recordState("Send Backward");
      storeSendBackward(nodeId);
    },
    [recordState, storeSendBackward],
  );

  return {
    addComponent,
    addBoundary,
    updateNodeData,
    updateEdgeData,
    deleteSelected,
    duplicateSelected,
    clearCanvas,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
  };
}
