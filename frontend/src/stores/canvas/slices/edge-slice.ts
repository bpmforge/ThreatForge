/**
 * Edge-related actions for the canvas store.
 */
import {
  applyEdgeChanges,
  addEdge,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import { toast } from "sonner";
import type {
  ConnectionData,
  ComponentNodeData,
  ComponentInterface,
  ComponentType,
} from "@/types/canvas";
import type { CanvasEdge, EdgeActions, SetState, GetState } from "../types";
import { generateId } from "../types";

const DATA_STORES: ComponentType[] = [
  "DATABASE",
  "CACHE",
  "QUEUE",
  "MESSAGE_QUEUE",
  "FILE_SYSTEM",
  "OBJECT_STORAGE",
  "DATA_LAKE",
  "DATA_STORE",
];
const EXTERNAL: ComponentType[] = ["ACTOR", "EXTERNAL_ENTITY"];

function warnUnusualConnection(
  srcType: ComponentType | undefined,
  tgtType: ComponentType | undefined,
): void {
  if (!srcType || !tgtType) return;
  if (DATA_STORES.includes(srcType) && DATA_STORES.includes(tgtType)) {
    toast.warning(
      "Data stores rarely connect directly — consider a service layer",
    );
  } else if (EXTERNAL.includes(srcType) && DATA_STORES.includes(tgtType)) {
    toast.warning(
      "Direct external-entity → data-store connections are a security risk",
    );
  }
}

/** Extract base interface ID from handle ID (format: {interfaceId}-source or {interfaceId}-target) */
/**
 * Interface handles are rendered as `${interfaceId}-source|-target`. Built-in
 * handles (`handle-left-s`, `handle-top`, …) carry no suffix and are NOT
 * interface ids — treating them as one made the load-time normalizer append a
 * suffix and React Flow then dropped the edge (error #008).
 */
const extractInterfaceId = (
  handleId: string | null | undefined,
): string | null => {
  if (!handleId) return null;
  if (!/-(?:source|target)$/.test(handleId)) return null;
  return handleId.replace(/-(?:source|target)$/, "");
};

export const createEdgeSlice = (set: SetState, get: GetState): EdgeActions => ({
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => {
    set(
      (state) => ({
        edges: applyEdgeChanges(changes, state.edges),
        isDirty: state.isDirty || changes.some((c) => c.type !== "select"),
      }),
      false,
      "onEdgesChange",
    );
  },

  onConnect: (connection: Connection) => {
    const state = get();
    const sourceNode = state.nodes.find((n) => n.id === connection.source);
    const targetNode = state.nodes.find((n) => n.id === connection.target);

    // Find the interfaces by handle ID (if using dynamic interfaces)
    let sourceInterface: ComponentInterface | undefined;
    let targetInterface: ComponentInterface | undefined;

    const sourceIfaceId = extractInterfaceId(connection.sourceHandle);
    const targetIfaceId = extractInterfaceId(connection.targetHandle);

    if (sourceNode?.data && "interfaces" in sourceNode.data && sourceIfaceId) {
      const nodeData = sourceNode.data as ComponentNodeData;
      sourceInterface = nodeData.interfaces?.find(
        (i) => i.id === sourceIfaceId,
      );
    }

    if (targetNode?.data && "interfaces" in targetNode.data && targetIfaceId) {
      const nodeData = targetNode.data as ComponentNodeData;
      targetInterface = nodeData.interfaces?.find(
        (i) => i.id === targetIfaceId,
      );
    }

    // Auto-populate edge data from interfaces
    const protocol = sourceInterface?.protocol ?? targetInterface?.protocol;
    const authentication =
      sourceInterface?.authentication ??
      targetInterface?.authentication ??
      "None";
    const encrypted =
      sourceInterface?.encrypted ?? targetInterface?.encrypted ?? false;

    // Merge data classifications from both interfaces
    const dataClassifications = [
      ...(sourceInterface?.dataClassifications ?? []),
      ...(targetInterface?.dataClassifications ?? []),
    ].filter((v, i, a) => a.indexOf(v) === i);

    const newEdge: CanvasEdge = {
      ...connection,
      id: generateId(),
      type: "security",
      data: {
        encrypted,
        authenticated: authentication !== "None",
        protocol,
        authentication,
        dataClassifications,
        sourceInterfaceId: sourceInterface?.id ?? sourceIfaceId ?? undefined,
        targetInterfaceId: targetInterface?.id ?? targetIfaceId ?? undefined,
        style: { lineStyle: "smoothstep" },
      },
    };

    const srcType = (sourceNode?.data as ComponentNodeData | undefined)?.type;
    const tgtType = (targetNode?.data as ComponentNodeData | undefined)?.type;
    warnUnusualConnection(srcType, tgtType);

    set(
      (state) => ({
        edges: addEdge(newEdge, state.edges),
        isDirty: true,
      }),
      false,
      "onConnect",
    );
  },

  updateEdgeData: (edgeId: string, data: Partial<ConnectionData>) => {
    set(
      (state) => ({
        edges: state.edges.map((edge) =>
          edge.id === edgeId
            ? { ...edge, data: { ...edge.data, ...data } }
            : edge,
        ),
        isDirty: true,
      }),
      false,
      "updateEdgeData",
    );
  },

  addEdges: (newEdges: CanvasEdge[]) => {
    set(
      (state) => ({
        edges: [...state.edges, ...newEdges],
        isDirty: true,
      }),
      false,
      "addEdges",
    );
  },

  reverseEdge: (edgeId: string) => {
    set(
      (state) => ({
        edges: state.edges.map((edge) => {
          if (edge.id !== edgeId) return edge;
          return {
            ...edge,
            source: edge.target,
            target: edge.source,
            sourceHandle: edge.targetHandle,
            targetHandle: edge.sourceHandle,
          };
        }),
        isDirty: true,
      }),
      false,
      "reverseEdge",
    );
  },
});
