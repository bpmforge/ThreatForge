import { useCallback, useState } from "react";
import type { FinalConnectionState } from "@xyflow/react";
import {
  isDroppableTarget,
  nodeIdAtPoint,
  pickFacingTargetHandle,
} from "@/components/canvas/edges/connect-target";
import { useCanvasStore } from "@/stores/canvas";
import type { ComponentType } from "@/types/canvas";

const DEFAULT_TOP5: ComponentType[] = [
  "API",
  "DATABASE",
  "WEB_APP",
  "AUTH_SERVICE",
  "LOAD_BALANCER",
];

// Stable fallback so the Zustand selector doesn't return a new object reference
// on every call (which would trigger React error #185 via useSyncExternalStore).
const EMPTY_USAGE_STATS: Record<string, number> = {};

export interface QuickAddState {
  x: number;
  y: number;
  sourceNodeId: string;
  sourceHandleId: string | null;
}

/**
 * Detects when a connection drag ends on empty canvas and exposes
 * state for rendering the QuickAddShapePicker at the drop position.
 */
export function useQuickAdd() {
  const [quickAdd, setQuickAdd] = useState<QuickAddState | null>(null);
  const addComponent = useCanvasStore((s) => s.addComponent);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const usageStats = useCanvasStore(
    (s) =>
      (s as unknown as { componentTypeUsageStats?: Record<string, number> })
        .componentTypeUsageStats ?? EMPTY_USAGE_STATS,
  );

  /** Sorted top-5 types by usage, falling back to defaults. */
  const top5: ComponentType[] = (() => {
    const sorted = DEFAULT_TOP5.slice().sort(
      (a, b) => (usageStats[b] ?? 0) - (usageStats[a] ?? 0),
    );
    return sorted;
  })();

  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      // Only trigger when the drag ended without a valid target
      if (state.isValid) return;
      const fromHandle = state.fromHandle;
      if (!fromHandle?.nodeId) return;

      const clientX =
        event instanceof MouseEvent
          ? event.clientX
          : (event.changedTouches?.[0]?.clientX ?? 0);
      const clientY =
        event instanceof MouseEvent
          ? event.clientY
          : (event.changedTouches?.[0]?.clientY ?? 0);

      // Floating drop: released ON a shape (not on a port) → connect to it,
      // entering through the side that faces the source. Lucid and draw.io
      // both attach on shape-body drops; requiring a pixel-precise port drop
      // was the #1 reason connections "didn't take".
      const { nodes, edges } = useCanvasStore.getState();
      const dropId = nodeIdAtPoint(clientX, clientY);
      const target = nodes.find((n) => n.id === dropId);
      if (isDroppableTarget(target, fromHandle.nodeId)) {
        const source = nodes.find((n) => n.id === fromHandle.nodeId);
        // Only an exact repeat (same port → same node) is a duplicate; a
        // second line from another port is a legitimate parallel flow.
        const duplicate = edges.some(
          (e) =>
            e.source === fromHandle.nodeId &&
            e.target === target.id &&
            (e.sourceHandle ?? null) === (fromHandle.id ?? null),
        );
        if (source && !duplicate) {
          onConnect({
            source: source.id,
            target: target.id,
            sourceHandle: fromHandle.id ?? null,
            targetHandle: pickFacingTargetHandle(source, target, nodes),
          });
        }
        return;
      }

      setQuickAdd({
        x: clientX,
        y: clientY,
        sourceNodeId: fromHandle.nodeId,
        sourceHandleId: fromHandle.id ?? null,
      });
    },
    [onConnect],
  );

  const confirmAdd = useCallback(
    (type: ComponentType, flowPosition: { x: number; y: number }) => {
      if (!quickAdd) return;
      // Add the new node
      const newNodeId = addComponent(type, flowPosition);
      // Connect source → new node
      onConnect({
        source: quickAdd.sourceNodeId,
        target: newNodeId,
        sourceHandle: quickAdd.sourceHandleId,
        targetHandle: null,
      });
      // Increment usage stats
      useCanvasStore.setState((state) => {
        const stats =
          (
            state as unknown as {
              componentTypeUsageStats?: Record<string, number>;
            }
          ).componentTypeUsageStats ?? {};
        return {
          componentTypeUsageStats: {
            ...stats,
            [type]: (stats[type] ?? 0) + 1,
          },
        } as unknown as typeof state;
      });
      setQuickAdd(null);
    },
    [quickAdd, addComponent, onConnect],
  );

  const dismiss = useCallback(() => setQuickAdd(null), []);

  return { quickAdd, top5, handleConnectEnd, confirmAdd, dismiss };
}
