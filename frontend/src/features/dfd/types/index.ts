/**
 * DFD Feature - Types
 */

type DFDLevel = "CONTEXT" | "PROCESS";
export type ExternalEntityType = "USER" | "SYSTEM" | "SERVICE";
export type FlowVolume = "LOW" | "MEDIUM" | "HIGH";
export type DataType =
  | "PII"
  | "PHI"
  | "FINANCIAL"
  | "CREDENTIALS"
  | "INTERNAL"
  | "PUBLIC"
  | "CUSTOM";

interface DFDProcess {
  id: string;
  nodeId: string;
  number: string;
  name: string;
  description?: string | null;
  positionX: number;
  positionY: number;
  dfdId: string;
  linkedComponentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DFDDataStore {
  id: string;
  nodeId: string;
  number: string;
  name: string;
  description?: string | null;
  dataTypes: DataType[];
  positionX: number;
  positionY: number;
  dfdId: string;
  linkedComponentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DFDExternalEntity {
  id: string;
  nodeId: string;
  name: string;
  entityType: ExternalEntityType;
  description?: string | null;
  positionX: number;
  positionY: number;
  dfdId: string;
  linkedComponentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DFDDataFlow {
  id: string;
  edgeId: string;
  number?: string | null;
  name: string;
  dataTypes: DataType[];
  volume?: FlowVolume | null;
  frequency?: string | null;
  dfdId: string;
  sourceProcessId?: string | null;
  sourceDataStoreId?: string | null;
  sourceEntityId?: string | null;
  targetProcessId?: string | null;
  targetDataStoreId?: string | null;
  targetEntityId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataFlowDiagram {
  id: string;
  name: string;
  level: DFDLevel;
  canvasState: {
    nodes: unknown[];
    edges: unknown[];
    viewport?: { x: number; y: number; zoom: number };
  };
  threatModelId: string;
  parentDfdId?: string | null;
  processes: DFDProcess[];
  dataStores: DFDDataStore[];
  externalEntities: DFDExternalEntity[];
  dataFlows: DFDDataFlow[];
  childDfds?: DataFlowDiagram[];
  createdAt: string;
  updatedAt: string;
}

export interface DataFlowDiagramSummary {
  id: string;
  name: string;
  level: DFDLevel;
  threatModelId: string;
  parentDfdId?: string | null;
  _count: {
    processes: number;
    dataStores: number;
    externalEntities: number;
    dataFlows: number;
  };
  createdAt: string;
  updatedAt: string;
}

// Request types
export interface CreateDFDRequest {
  name: string;
  level?: DFDLevel;
  parentDfdId?: string;
}

export interface UpdateDFDRequest {
  name?: string;
  canvasState?: {
    nodes: unknown[];
    edges: unknown[];
    viewport?: { x: number; y: number; zoom: number };
  };
}
