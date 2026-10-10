/**
 * Canvas store for React Flow state management.
 *
 * Uses Zustand for UI state. Server sync handled by TanStack Query.
 * Refactored into modular slices for maintainability.
 */
import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import type { CanvasStore, CanvasState, SetState, GetState } from "./types";
import {
  createNodeSlice,
  createEdgeSlice,
  createSelectionSlice,
  createLayerSlice,
  createBoundarySlice,
  createPersistenceSlice,
  createCanvasLayersSlice,
} from "./slices";
import { isFeatureEnabled } from "@/lib/feature-flags";

/** Security overlay preference: localStorage override, env override, default on. */
function readSecurityOverlay(): boolean {
  return isFeatureEnabled("security-overlay");
}

/** Initial canvas state */
const initialState: CanvasState = {
  nodes: [],
  edges: [],
  selectedNodeIds: [],
  selectedEdgeIds: [],
  isDirty: false,
  referenceLinks: [],
  extractedRequirements: [],
  hoveredNodeId: null,
  securityOverlay: readSecurityOverlay(),
  layers: [],
  nodeLayerMap: {},
};

/**
 * Main canvas store combining all slices.
 */
export const useCanvasStore = create<CanvasStore>()(
  devtools(
    subscribeWithSelector((set, get) => {
      // Cast to our slice-compatible types
      const setState = set as unknown as SetState;
      const getState = get as GetState;

      return {
        // Initial state
        ...initialState,

        // Compose all slices
        ...createNodeSlice(setState, getState),
        ...createEdgeSlice(setState, getState),
        ...createSelectionSlice(setState, getState),
        ...createLayerSlice(setState, getState),
        ...createBoundarySlice(setState, getState),
        ...createPersistenceSlice(setState),
        ...createCanvasLayersSlice(setState, getState),
      };
    }),
    { name: "CanvasStore" },
  ),
);

// Re-export types for convenience
export type { CanvasNode, CanvasEdge, CanvasStore } from "./types";

// Re-export constants
export { getDefaultLabel } from "./constants";
