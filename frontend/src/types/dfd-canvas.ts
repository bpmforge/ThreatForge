/**
 * DFD Canvas Types - React Flow types for Data Flow Diagrams
 */
import type { Node, Edge } from "@xyflow/react";
import type { DataType, FlowVolume, ExternalEntityType } from "@/features/dfd";

/** DFD Process node data */
export interface DFDProcessNodeData extends Record<string, unknown> {
  number: string;
  name: string;
  description?: string;
  linkedComponentId?: string;
}

/** DFD Data Store node data */
export interface DFDDataStoreNodeData extends Record<string, unknown> {
  number: string;
  name: string;
  description?: string;
  dataTypes: DataType[];
  linkedComponentId?: string;
}

/** DFD External Entity node data */
export interface DFDExternalEntityNodeData extends Record<string, unknown> {
  name: string;
  entityType: ExternalEntityType;
  description?: string;
  linkedComponentId?: string;
}

/** DFD Data Flow edge data */
export interface DFDDataFlowEdgeData extends Record<string, unknown> {
  number?: string;
  name: string;
  dataTypes: DataType[];
  volume?: FlowVolume;
  frequency?: string;
}

/** Typed React Flow nodes for DFD */
type DFDProcessNode = Node<DFDProcessNodeData, "dfd-process">;
type DFDDataStoreNode = Node<DFDDataStoreNodeData, "dfd-datastore">;
type DFDExternalEntityNode = Node<DFDExternalEntityNodeData, "dfd-entity">;

/** Union of all DFD node types */
export type DFDNode = DFDProcessNode | DFDDataStoreNode | DFDExternalEntityNode;

/** Typed React Flow edge for DFD */
export type DFDEdge = Edge<DFDDataFlowEdgeData>;
