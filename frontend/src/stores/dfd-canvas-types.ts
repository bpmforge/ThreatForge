import type { DFDNode, DFDEdge } from "@/types/dfd-canvas";
import type { ExternalEntityType } from "@/features/dfd";
import type { NodeChange, EdgeChange, Connection } from "@xyflow/react";

interface DFDCanvasState {
  activeDfdId: string | null;
  nodes: DFDNode[];
  edges: DFDEdge[];
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  isDirty: boolean;
  processCounter: number;
  dataStoreCounter: number;
}

interface DFDCanvasActions {
  setActiveDfd: (dfdId: string | null) => void;
  onNodesChange: (changes: NodeChange<DFDNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<DFDEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addProcess: (position: { x: number; y: number }, name?: string) => string;
  addDataStore: (position: { x: number; y: number }, name?: string) => string;
  addExternalEntity: (
    position: { x: number; y: number },
    entityType: ExternalEntityType,
    name?: string,
  ) => string;
  updateNodeData: (nodeId: string, data: Partial<DFDNode["data"]>) => void;
  updateEdgeData: (edgeId: string, data: Partial<DFDEdge["data"]>) => void;
  deleteSelected: () => void;
  setSelection: (nodeIds: string[], edgeIds: string[]) => void;
  loadCanvas: (dfdId: string, nodes: DFDNode[], edges: DFDEdge[]) => void;
  addNodes: (nodes: DFDNode[]) => void;
  addEdges: (edges: DFDEdge[]) => void;
  clearCanvas: () => void;
  markSaved: () => void;
  getCanvasState: () => { nodes: DFDNode[]; edges: DFDEdge[] };
}

export type DFDCanvasStore = DFDCanvasState & DFDCanvasActions;

export const generateId = () =>
  `dfd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
