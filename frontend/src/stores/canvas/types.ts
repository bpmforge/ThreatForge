/**
 * Types for the canvas store.
 */
import type { StoreApi } from "zustand";
import type {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
} from "@xyflow/react";
import type {
  ComponentNodeData,
  BoundaryNodeData,
  LegendNodeData,
  SwimlaneNodeData,
  ConnectionData,
  ComponentType,
} from "@/types/canvas";

/** Generic node type for the store */
export type CanvasNode = Node<
  ComponentNodeData | BoundaryNodeData | LegendNodeData | SwimlaneNodeData
>;

/** Generic edge type for the store */
export type CanvasEdge = Edge<ConnectionData>;

/** A named canvas layer for organizing nodes (visibility + lock) */
export interface CanvasLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color?: string;
}

/** Reference link for external documents */
export interface ReferenceLink {
  id: string;
  url: string;
  title: string;
  type: string;
  description?: string;
  addedAt: string;
}

/** Requirement extracted from an imported document (SRS, SAD, etc.) */
export interface ExtractedRequirement {
  id: string;
  reqId: string; // e.g. "FR-12", "SEC-3"
  text: string; // e.g. "System shall use TLS 1.3 for all external connections"
  docId: string; // e.g. "SRS", "SAD" — source document label
  category?: string; // e.g. "security", "functional"
}

/** Canvas state shape */
export interface CanvasState {
  /** All nodes on the canvas */
  nodes: CanvasNode[];
  /** All edges (connections) on the canvas */
  edges: CanvasEdge[];
  /** Currently selected node IDs */
  selectedNodeIds: string[];
  /** Currently selected edge IDs */
  selectedEdgeIds: string[];
  /** Whether canvas has unsaved changes */
  isDirty: boolean;
  /** Node ID currently hovered (for edge highlight). Transient — not persisted. */
  hoveredNodeId: string | null;
  /** Reference links to external documents */
  referenceLinks: ReferenceLink[];
  /** Requirements extracted from imported documents (SRS, SAD, etc.) */
  extractedRequirements: ExtractedRequirement[];
  /** When true, protocol/auth pills are always visible on edges (not just on hover/select). */
  securityOverlay: boolean;
  /** Named canvas layers for organizing nodes */
  layers: CanvasLayer[];
  /** Maps nodeId → layerId for layer membership */
  nodeLayerMap: Record<string, string>;
}

/** Node-related actions */
export interface NodeActions {
  /** Handle React Flow node changes (move, select, etc.) */
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  /** Add a new component node */
  addComponent: (
    type: ComponentType,
    position: { x: number; y: number },
    label?: string,
  ) => string;
  /** Add a new boundary (group) node */
  addBoundary: (position: { x: number; y: number }, label?: string) => string;
  /** Update node data */
  updateNodeData: (
    nodeId: string,
    data: Partial<ComponentNodeData | BoundaryNodeData>,
  ) => void;
  /** Add multiple nodes at once (for import) */
  addNodes: (nodes: CanvasNode[]) => void;
  /** Toggle locked state on a node */
  toggleNodeLock: (nodeId: string) => void;
  /** Add a legend node at the given position */
  addLegend: (position: { x: number; y: number }) => string;
  /** Add a swimlane node at the given position */
  addSwimlane: (position: { x: number; y: number }, label?: string) => string;
  /** Auto-arrange non-boundary nodes into a tiered grid layout */
  autoLayout: () => void;
  /** Toggle collapse state of a boundary, hiding/showing its children */
  toggleBoundaryCollapse: (boundaryId: string) => void;
}

/** Edge-related actions */
export interface EdgeActions {
  /** Handle React Flow edge changes */
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void;
  /** Handle new connection between nodes */
  onConnect: (connection: Connection) => void;
  /** Update edge data */
  updateEdgeData: (edgeId: string, data: Partial<ConnectionData>) => void;
  /** Add multiple edges at once (for import) */
  addEdges: (edges: CanvasEdge[]) => void;
  /** Reverse an edge's direction (swap source/target). */
  reverseEdge: (edgeId: string) => void;
}

/** Selection and clipboard actions */
export interface SelectionActions {
  /** Delete selected nodes and edges */
  deleteSelected: () => void;
  /** Set selection */
  setSelection: (nodeIds: string[], edgeIds: string[]) => void;
  /** Duplicate selected nodes */
  duplicateSelected: () => void;
  /** Track which node is hovered (for edge highlight) */
  setHoveredNodeId: (id: string | null) => void;
}

/** Z-index layer actions */
export interface LayerActions {
  /** Bring node to front (highest z-index) */
  bringToFront: (nodeId: string) => void;
  /** Send node to back (lowest z-index) */
  sendToBack: (nodeId: string) => void;
  /** Bring node one level forward */
  bringForward: (nodeId: string) => void;
  /** Send node one level backward */
  sendBackward: (nodeId: string) => void;
}

/** Boundary/grouping actions */
export interface BoundaryActions {
  /** Update a node's parent (for boundary grouping) */
  updateNodeParent: (nodeId: string, parentId: string | null) => void;
  /**
   * Grow a boundary (and, cascading, its ancestors) so every child sits fully
   * inside with BOUNDARY_INNER_PAD clearance and below the header.
   */
  fitBoundaryToChildren: (boundaryId: string) => void;
  /**
   * Adopt every node whose centre now lies inside the boundary (after it was
   * moved or resized), then fit — nothing is left straddling the edge.
   */
  adoptContainedNodes: (boundaryId: string) => void;
  /**
   * After a node lands (drag-stop or palette drop): a boundary adopts what it
   * covers, the node parents into the innermost zone under its centre (or
   * leaves one), and the zones involved fit with 10px clearance.
   * `relativePosition` is the in-flight position in the node's CURRENT frame.
   */
  settleContainment: (
    nodeId: string,
    relativePosition?: { x: number; y: number },
  ) => void;
  /** Update a boundary's size */
  updateBoundarySize: (
    boundaryId: string,
    width: number,
    height: number,
  ) => void;
  /** Get all children of a boundary */
  getBoundaryChildren: (boundaryId: string) => CanvasNode[];
}

/** Canvas layer management actions */
export interface CanvasLayerActions {
  /** Add a new layer */
  addLayer: (name?: string) => string;
  /** Delete a layer (nodes in it revert to no layer) */
  deleteLayer: (layerId: string) => void;
  /** Show or hide all nodes on a layer */
  setLayerVisibility: (layerId: string, visible: boolean) => void;
  /** Lock or unlock all nodes on a layer */
  setLayerLocked: (layerId: string, locked: boolean) => void;
  /** Rename a layer */
  renameLayer: (layerId: string, name: string) => void;
  /** Assign a node to a layer (null = remove from all layers) */
  setNodeLayer: (nodeId: string, layerId: string | null) => void;
}

/** Canvas persistence actions */
export interface PersistenceActions {
  /** Load canvas state from server */
  loadCanvas: (nodes: CanvasNode[], edges: CanvasEdge[]) => void;
  /** Clear the canvas */
  clearCanvas: () => void;
  /** Mark canvas as saved */
  markSaved: () => void;
  /** Set reference links */
  setReferenceLinks: (links: ReferenceLink[]) => void;
  /** Set requirements extracted from imported documents */
  setExtractedRequirements: (reqs: ExtractedRequirement[]) => void;
  /** Toggle the security overlay (protocol/auth pills always visible vs hover-only). Persisted to localStorage. */
  toggleSecurityOverlay: () => void;
}

/** All canvas actions combined */
type CanvasActions = NodeActions &
  EdgeActions &
  SelectionActions &
  LayerActions &
  BoundaryActions &
  PersistenceActions &
  CanvasLayerActions;

/** Complete canvas store type */
export type CanvasStore = CanvasState & CanvasActions;

/** Generate unique IDs */
export const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * SetState type for slices with devtools action name support.
 * The third parameter is the action name for Redux DevTools.
 */
export type SetState = (
  partial:
    | CanvasStore
    | Partial<CanvasStore>
    | ((state: CanvasStore) => CanvasStore | Partial<CanvasStore>),
  replace?: boolean,
  action?: string,
) => void;

/** Zustand GetState type for slices */
export type GetState = StoreApi<CanvasStore>["getState"];
