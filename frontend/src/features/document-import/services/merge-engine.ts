/**
 * Merge Engine Service
 *
 * Smart deduplication for multi-document import.
 * When a team uploads SRS, then SAD, then SDS for the same system,
 * this engine matches new extracted components against existing canvas
 * nodes and merges instead of creating duplicates.
 */

import type { ExtractedArchitecture } from "../types";
import type {
  MergePlan,
  MergeCandidate,
  FlowMergeCandidate,
  BoundaryMergeCandidate,
  ExistingCanvasState,
} from "./merge-engine-types";
import { nameMatchScore, componentMatchScore } from "./merge-engine-scoring";

export type {
  MergeCandidate,
  FlowMergeCandidate,
  MergePlan,
  ExistingCanvasState,
} from "./merge-engine-types";
export {
  applyMergePlan,
  canvasHasComponents,
  summarizeExistingComponents,
} from "./merge-engine-apply";

/**
 * Build a merge plan by matching extracted architecture against existing canvas.
 * Does NOT modify anything — returns a plan for user review.
 */
export function buildMergePlan(
  extraction: ExtractedArchitecture,
  existing: ExistingCanvasState,
): MergePlan {
  const MATCH_THRESHOLD = 0.6;

  // ─── Component matching ───
  const componentCandidates: MergeCandidate[] = [];
  const usedExistingIds = new Set<string>();

  for (const comp of extraction.components.filter((c) => c.selected)) {
    let bestMatch: {
      nodeId: string;
      label: string;
      score: number;
      reason: string;
    } | null = null;

    for (const node of existing.nodes) {
      if (node.type === "boundary") continue;
      if (usedExistingIds.has(node.id)) continue;

      const { score, reason } = componentMatchScore(comp, node);
      if (score >= MATCH_THRESHOLD && (!bestMatch || score > bestMatch.score)) {
        bestMatch = {
          nodeId: node.id,
          label: node.data.label || node.id,
          score,
          reason,
        };
      }
    }

    if (bestMatch) {
      usedExistingIds.add(bestMatch.nodeId);
      componentCandidates.push({
        extracted: comp,
        action: "update",
        matchedNodeId: bestMatch.nodeId,
        matchedNodeLabel: bestMatch.label,
        matchScore: bestMatch.score,
        matchReason: bestMatch.reason,
      });
    } else {
      componentCandidates.push({
        extracted: comp,
        action: "add",
        matchScore: 0,
      });
    }
  }

  // ─── Data flow matching ───
  const idRemap = new Map<string, string>();
  for (const c of componentCandidates) {
    if (c.matchedNodeId) idRemap.set(c.extracted.id, c.matchedNodeId);
  }

  const flowCandidates: FlowMergeCandidate[] = [];
  for (const flow of extraction.dataFlows.filter((f) => f.selected)) {
    const remappedSource = idRemap.get(flow.sourceId) || flow.sourceId;
    const remappedTarget = idRemap.get(flow.targetId) || flow.targetId;

    const existingEdge = existing.edges.find(
      (e) =>
        (e.source === remappedSource && e.target === remappedTarget) ||
        (e.source === remappedTarget && e.target === remappedSource),
    );

    flowCandidates.push(
      existingEdge
        ? {
            extracted: flow,
            action: "skip",
            matchedEdgeId: existingEdge.id,
            matchScore: 1.0,
          }
        : { extracted: flow, action: "add", matchScore: 0 },
    );
  }

  // ─── Boundary matching ───
  const boundaryCandidates: BoundaryMergeCandidate[] = [];
  for (const boundary of (extraction.boundaries || []).filter(
    (b) => b.selected,
  )) {
    const existingBoundary = existing.nodes.find(
      (n) =>
        n.type === "boundary" &&
        (n.data.trustLevel === boundary.trustLevel ||
          nameMatchScore(n.data.label || "", boundary.name) >= 0.7),
    );

    boundaryCandidates.push(
      existingBoundary
        ? {
            extracted: boundary,
            action: "update",
            matchedBoundaryId: existingBoundary.id,
            matchScore: 0.9,
          }
        : { extracted: boundary, action: "add", matchScore: 0 },
    );
  }

  return {
    components: componentCandidates,
    dataFlows: flowCandidates,
    boundaries: boundaryCandidates,
    stats: {
      newComponents: componentCandidates.filter((c) => c.action === "add")
        .length,
      updatedComponents: componentCandidates.filter(
        (c) => c.action === "update",
      ).length,
      skippedComponents: componentCandidates.filter((c) => c.action === "skip")
        .length,
      newFlows: flowCandidates.filter((f) => f.action === "add").length,
      skippedFlows: flowCandidates.filter((f) => f.action === "skip").length,
      newBoundaries: boundaryCandidates.filter((b) => b.action === "add")
        .length,
      mergedBoundaries: boundaryCandidates.filter((b) => b.action === "update")
        .length,
    },
  };
}
