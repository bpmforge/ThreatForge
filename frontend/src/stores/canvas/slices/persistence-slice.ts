/**
 * Canvas persistence actions for the canvas store.
 */
import type {
  CanvasNode,
  CanvasEdge,
  PersistenceActions,
  ReferenceLink,
  ExtractedRequirement,
  SetState,
} from "../types";
import { sortParentsFirst } from "../geometry";

/**
 * Built-in (non-interface) handle ids — `handle-top`, `handle-left-s`, … —
 * rendered by ComponentNodeHandles when a node has no interfaces.
 */
const STATIC_HANDLE = /^handle-/;
const IFACE_SUFFIX = /-(?:source|target)$/;

/**
 * Ensure edge handles have the -source/-target suffix for React Flow handle
 * matching — but ONLY for interface handles. Static handles must be left
 * exactly as rendered: appending a suffix to `handle-left-s` produced
 * `handle-left-s-source`, which no node renders, so React Flow silently
 * dropped the edge ("Couldn't create edge for source handle id", error #008).
 * Edges saved while that bug was live are repaired here on load.
 */
export function normalizeEdgeHandles(edges: CanvasEdge[]): CanvasEdge[] {
  return edges.map((edge) => {
    let { sourceHandle, targetHandle } = edge;
    let sourceIfaceId = edge.data?.sourceInterfaceId;
    let targetIfaceId = edge.data?.targetInterfaceId;
    let dataChanged = false;

    // Repair: a static handle id is never an interface id.
    if (sourceIfaceId && STATIC_HANDLE.test(sourceIfaceId)) {
      sourceIfaceId = undefined;
      dataChanged = true;
    }
    if (targetIfaceId && STATIC_HANDLE.test(targetIfaceId)) {
      targetIfaceId = undefined;
      dataChanged = true;
    }

    if (sourceHandle && STATIC_HANDLE.test(sourceHandle)) {
      sourceHandle = sourceHandle.replace(IFACE_SUFFIX, "");
    } else if (
      sourceIfaceId &&
      sourceHandle &&
      !IFACE_SUFFIX.test(sourceHandle)
    ) {
      sourceHandle = `${sourceHandle}-source`;
    } else if (sourceIfaceId && !sourceHandle) {
      sourceHandle = `${sourceIfaceId}-source`;
    }

    if (targetHandle && STATIC_HANDLE.test(targetHandle)) {
      targetHandle = targetHandle.replace(IFACE_SUFFIX, "");
    } else if (
      targetIfaceId &&
      targetHandle &&
      !IFACE_SUFFIX.test(targetHandle)
    ) {
      targetHandle = `${targetHandle}-target`;
    } else if (targetIfaceId && !targetHandle) {
      targetHandle = `${targetIfaceId}-target`;
    }

    const data = dataChanged
      ? {
          ...edge.data,
          sourceInterfaceId: sourceIfaceId,
          targetInterfaceId: targetIfaceId,
        }
      : edge.data;

    return { ...edge, sourceHandle, targetHandle, data };
  });
}

export const createPersistenceSlice = (set: SetState): PersistenceActions => ({
  loadCanvas: (nodes: CanvasNode[], edges: CanvasEdge[]) => {
    set(
      {
        // React Flow needs parents before children in the array. Persisted
        // children may still carry `extent: "parent"` from before UC-19's
        // drag-out fix — that clamps them inside the boundary forever, so it
        // is stripped on load (containment is enforced on drop instead).
        nodes: sortParentsFirst(
          nodes.map((n) =>
            n.extent === "parent" ? { ...n, extent: undefined } : n,
          ),
        ),
        edges: normalizeEdgeHandles(edges),
        isDirty: false,
      },
      false,
      "loadCanvas",
    );
  },

  clearCanvas: () => {
    set(
      {
        nodes: [],
        edges: [],
        selectedNodeIds: [],
        selectedEdgeIds: [],
        isDirty: true,
      },
      false,
      "clearCanvas",
    );
  },

  markSaved: () => {
    set({ isDirty: false }, false, "markSaved");
  },

  setReferenceLinks: (links: ReferenceLink[]) => {
    set({ referenceLinks: links, isDirty: true }, false, "setReferenceLinks");
  },

  setExtractedRequirements: (reqs: ExtractedRequirement[]) => {
    set({ extractedRequirements: reqs }, false, "setExtractedRequirements");
  },

  toggleSecurityOverlay: () => {
    set(
      (state) => {
        const next = !state.securityOverlay;
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("ff:security-overlay", String(next));
        }
        return { securityOverlay: next };
      },
      false,
      "toggleSecurityOverlay",
    );
  },
});
