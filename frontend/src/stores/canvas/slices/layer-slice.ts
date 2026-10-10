/**
 * Z-index layer actions for the canvas store.
 */
import type { LayerActions, SetState, GetState } from "../types";

export const createLayerSlice = (
  set: SetState,
  get: GetState,
): LayerActions => ({
  bringToFront: (nodeId: string) => {
    const { nodes } = get();
    const maxZ = Math.max(...nodes.map((n) => n.zIndex ?? 0), 0);
    set(
      (state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId ? { ...node, zIndex: maxZ + 1 } : node,
        ),
        isDirty: true,
      }),
      false,
      "bringToFront",
    );
  },

  sendToBack: (nodeId: string) => {
    const { nodes } = get();
    const minZ = Math.min(...nodes.map((n) => n.zIndex ?? 0), 0);
    set(
      (state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId ? { ...node, zIndex: minZ - 1 } : node,
        ),
        isDirty: true,
      }),
      false,
      "sendToBack",
    );
  },

  bringForward: (nodeId: string) => {
    set(
      (state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId
            ? { ...node, zIndex: (node.zIndex ?? 0) + 1 }
            : node,
        ),
        isDirty: true,
      }),
      false,
      "bringForward",
    );
  },

  sendBackward: (nodeId: string) => {
    set(
      (state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId
            ? { ...node, zIndex: (node.zIndex ?? 0) - 1 }
            : node,
        ),
        isDirty: true,
      }),
      false,
      "sendBackward",
    );
  },
});
