import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  MarkerType,
} from "@xyflow/react";
import type { DFDNode, DFDEdge } from "@/types/dfd-canvas";
import type { DataType, ExternalEntityType } from "@/features/dfd";
import { type DFDCanvasStore, generateId } from "./dfd-canvas-types";

export type { DFDCanvasStore } from "./dfd-canvas-types";

export const useDFDCanvasStore = create<DFDCanvasStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      activeDfdId: null,
      nodes: [],
      edges: [],
      selectedNodeIds: [],
      selectedEdgeIds: [],
      isDirty: false,
      processCounter: 1,
      dataStoreCounter: 1,

      setActiveDfd: (dfdId) => {
        set({ activeDfdId: dfdId }, false, "setActiveDfd");
      },

      onNodesChange: (changes) => {
        set(
          (state) => ({
            nodes: applyNodeChanges(changes, state.nodes) as DFDNode[],
            isDirty: true,
          }),
          false,
          "onNodesChange",
        );
      },

      onEdgesChange: (changes) => {
        set(
          (state) => ({
            edges: applyEdgeChanges(changes, state.edges) as DFDEdge[],
            isDirty: true,
          }),
          false,
          "onEdgesChange",
        );
      },

      onConnect: (connection) => {
        const newEdge: DFDEdge = {
          ...connection,
          id: generateId(),
          type: "dfd-flow",
          markerEnd: { type: MarkerType.ArrowClosed },
          data: {
            name: "Data Flow",
            dataTypes: [] as DataType[],
          },
        };
        set(
          (state) => ({
            edges: addEdge(newEdge, state.edges) as DFDEdge[],
            isDirty: true,
          }),
          false,
          "onConnect",
        );
      },

      addProcess: (position, name) => {
        const id = generateId();
        const { processCounter } = get();
        const newNode: DFDNode = {
          id,
          type: "dfd-process",
          position,
          data: {
            number: `${processCounter}.0`,
            name: name || `Process ${processCounter}`,
          },
        };
        set(
          (state) => ({
            nodes: [...state.nodes, newNode],
            processCounter: state.processCounter + 1,
            isDirty: true,
          }),
          false,
          "addProcess",
        );
        return id;
      },

      addDataStore: (position, name) => {
        const id = generateId();
        const { dataStoreCounter } = get();
        const newNode: DFDNode = {
          id,
          type: "dfd-datastore",
          position,
          data: {
            number: `D${dataStoreCounter}`,
            name: name || `Data Store ${dataStoreCounter}`,
            dataTypes: [] as DataType[],
          },
        };
        set(
          (state) => ({
            nodes: [...state.nodes, newNode],
            dataStoreCounter: state.dataStoreCounter + 1,
            isDirty: true,
          }),
          false,
          "addDataStore",
        );
        return id;
      },

      addExternalEntity: (position, entityType, name) => {
        const id = generateId();
        const typeLabels: Record<ExternalEntityType, string> = {
          USER: "User",
          SYSTEM: "External System",
          SERVICE: "External Service",
        };
        const newNode: DFDNode = {
          id,
          type: "dfd-entity",
          position,
          data: {
            name: name || typeLabels[entityType],
            entityType,
          },
        };
        set(
          (state) => ({
            nodes: [...state.nodes, newNode],
            isDirty: true,
          }),
          false,
          "addExternalEntity",
        );
        return id;
      },

      updateNodeData: (nodeId, data) => {
        set(
          (state) => ({
            nodes: state.nodes.map((node) =>
              node.id === nodeId
                ? { ...node, data: { ...node.data, ...data } }
                : node,
            ) as DFDNode[],
            isDirty: true,
          }),
          false,
          "updateNodeData",
        );
      },

      updateEdgeData: (edgeId, data) => {
        set(
          (state) => ({
            edges: state.edges.map((edge) =>
              edge.id === edgeId
                ? { ...edge, data: { ...edge.data, ...data } }
                : edge,
            ) as DFDEdge[],
            isDirty: true,
          }),
          false,
          "updateEdgeData",
        );
      },

      deleteSelected: () => {
        const { selectedNodeIds, selectedEdgeIds } = get();
        set(
          (state) => ({
            nodes: state.nodes.filter((n) => !selectedNodeIds.includes(n.id)),
            edges: state.edges.filter(
              (e) =>
                !selectedEdgeIds.includes(e.id) &&
                !selectedNodeIds.includes(e.source) &&
                !selectedNodeIds.includes(e.target),
            ),
            selectedNodeIds: [],
            selectedEdgeIds: [],
            isDirty: true,
          }),
          false,
          "deleteSelected",
        );
      },

      setSelection: (nodeIds, edgeIds) => {
        set(
          { selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds },
          false,
          "setSelection",
        );
      },

      loadCanvas: (dfdId, nodes, edges) => {
        let maxProcess = 0;
        let maxDataStore = 0;
        nodes.forEach((node) => {
          if (node.type === "dfd-process" && node.data.number) {
            const num = parseInt(node.data.number.split(".")[0], 10);
            if (!isNaN(num) && num > maxProcess) maxProcess = num;
          }
          if (node.type === "dfd-datastore" && node.data.number) {
            const num = parseInt(node.data.number.replace("D", ""), 10);
            if (!isNaN(num) && num > maxDataStore) maxDataStore = num;
          }
        });
        set(
          {
            activeDfdId: dfdId,
            nodes,
            edges,
            isDirty: false,
            processCounter: maxProcess + 1,
            dataStoreCounter: maxDataStore + 1,
          },
          false,
          "loadCanvas",
        );
      },

      addNodes: (newNodes) => {
        set(
          (state) => ({
            nodes: [...state.nodes, ...newNodes],
            isDirty: true,
          }),
          false,
          "addNodes",
        );
      },

      addEdges: (newEdges) => {
        set(
          (state) => ({
            edges: [...state.edges, ...newEdges],
            isDirty: true,
          }),
          false,
          "addEdges",
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
            processCounter: 1,
            dataStoreCounter: 1,
          },
          false,
          "clearCanvas",
        );
      },

      markSaved: () => {
        set({ isDirty: false }, false, "markSaved");
      },

      getCanvasState: () => {
        const { nodes, edges } = get();
        return { nodes, edges };
      },
    })),
    { name: "DFDCanvasStore" },
  ),
);
