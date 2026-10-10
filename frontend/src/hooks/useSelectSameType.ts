/**
 * useSelectSameType - select all component nodes that share the same type
 * as a given reference node.
 */
import { useCallback } from "react";
import { useCanvasStore } from "@/stores/canvas";
import type { ComponentNodeData } from "@/types/canvas";

export function useSelectSameType() {
  const selectSameType = useCallback((referenceNodeId: string) => {
    const { nodes, setSelection } = useCanvasStore.getState();
    const ref = nodes.find((n) => n.id === referenceNodeId);
    if (!ref || ref.type !== "component") return;

    const refType = (ref.data as ComponentNodeData).type;
    const matchIds = nodes
      .filter(
        (n) =>
          n.type === "component" &&
          (n.data as ComponentNodeData).type === refType,
      )
      .map((n) => n.id);

    setSelection(matchIds, []);
  }, []);

  return { selectSameType };
}
