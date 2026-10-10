import { useCallback, useState } from "react";
import { reconnectEdge, type Connection } from "@xyflow/react";
import { useCanvasStore, type CanvasEdge } from "@/stores/canvas";

/**
 * Encapsulates React Flow's edge-reconnect wiring.
 *
 * Usage:
 *   const { onReconnect, onReconnectStart, onReconnectEnd } = useEdgeReconnect();
 *   <ReactFlow edgesReconnectable onReconnect={onReconnect} ... />
 */
export function useEdgeReconnect() {
  const [isReconnecting, setIsReconnecting] = useState(false);

  const handleReconnect = useCallback(
    (oldEdge: CanvasEdge, newConnection: Connection) => {
      const currentEdges = useCanvasStore.getState().edges;
      const updated = reconnectEdge(
        oldEdge,
        newConnection,
        currentEdges,
      ) as CanvasEdge[];
      useCanvasStore.setState({ edges: updated, isDirty: true });
    },
    [],
  );

  const handleReconnectStart = useCallback(() => {
    setIsReconnecting(true);
  }, []);

  const handleReconnectEnd = useCallback(() => {
    setIsReconnecting(false);
  }, []);

  return {
    isReconnecting,
    onReconnect: handleReconnect,
    onReconnectStart: handleReconnectStart,
    onReconnectEnd: handleReconnectEnd,
  };
}
