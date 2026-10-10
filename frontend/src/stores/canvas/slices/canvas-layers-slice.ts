/**
 * Canvas layers slice — named layers for organizing and controlling node visibility/lock.
 */
import type {
  CanvasLayerActions,
  CanvasLayer,
  SetState,
  GetState,
} from "../types";
import { generateId } from "../types";

export const createCanvasLayersSlice = (
  set: SetState,
  get: GetState,
): CanvasLayerActions => ({
  addLayer: (name?: string) => {
    const id = generateId();
    const layers = get().layers;
    const layer: CanvasLayer = {
      id,
      name: name || `Layer ${layers.length + 1}`,
      visible: true,
      locked: false,
    };
    set((state) => ({ layers: [...state.layers, layer] }), false, "addLayer");
    return id;
  },

  deleteLayer: (layerId: string) => {
    set(
      (state) => ({
        layers: state.layers.filter((l) => l.id !== layerId),
        nodeLayerMap: Object.fromEntries(
          Object.entries(state.nodeLayerMap).filter(([, v]) => v !== layerId),
        ),
      }),
      false,
      "deleteLayer",
    );
  },

  setLayerVisibility: (layerId: string, visible: boolean) => {
    set(
      (state) => ({
        layers: state.layers.map((l) =>
          l.id === layerId ? { ...l, visible } : l,
        ),
      }),
      false,
      "setLayerVisibility",
    );
  },

  setLayerLocked: (layerId: string, locked: boolean) => {
    set(
      (state) => ({
        layers: state.layers.map((l) =>
          l.id === layerId ? { ...l, locked } : l,
        ),
      }),
      false,
      "setLayerLocked",
    );
  },

  renameLayer: (layerId: string, name: string) => {
    set(
      (state) => ({
        layers: state.layers.map((l) =>
          l.id === layerId ? { ...l, name } : l,
        ),
      }),
      false,
      "renameLayer",
    );
  },

  setNodeLayer: (nodeId: string, layerId: string | null) => {
    set(
      (state) => {
        const map = { ...state.nodeLayerMap };
        if (layerId === null) {
          delete map[nodeId];
        } else {
          map[nodeId] = layerId;
        }
        return { nodeLayerMap: map };
      },
      false,
      "setNodeLayer",
    );
  },
});
