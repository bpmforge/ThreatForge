import type {
  ExtractedComponent,
  ExtractedDataFlow,
  ExtractedBoundary,
  GeneratedNode,
  GeneratedEdge,
} from "../types";

export type { ExtractedComponent, GeneratedNode };

/** How a component matched against existing canvas */
type MergeAction = "add" | "update" | "skip";

/** A component with its merge decision */
export interface MergeCandidate {
  extracted: ExtractedComponent;
  action: MergeAction;
  matchedNodeId?: string;
  matchedNodeLabel?: string;
  matchScore: number;
  matchReason?: string;
}

/** A data flow with its merge decision */
export interface FlowMergeCandidate {
  extracted: ExtractedDataFlow;
  action: MergeAction;
  matchedEdgeId?: string;
  matchScore: number;
}

/** A boundary with its merge decision */
export interface BoundaryMergeCandidate {
  extracted: ExtractedBoundary;
  action: MergeAction;
  matchedBoundaryId?: string;
  matchScore: number;
}

/** Full merge plan for user review */
export interface MergePlan {
  components: MergeCandidate[];
  dataFlows: FlowMergeCandidate[];
  boundaries: BoundaryMergeCandidate[];
  stats: {
    newComponents: number;
    updatedComponents: number;
    skippedComponents: number;
    newFlows: number;
    skippedFlows: number;
    newBoundaries: number;
    mergedBoundaries: number;
  };
}

/** Existing canvas state passed in for matching */
export interface ExistingCanvasState {
  nodes: GeneratedNode[];
  edges: GeneratedEdge[];
}
