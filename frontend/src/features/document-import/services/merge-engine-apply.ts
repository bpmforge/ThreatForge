import type { ExtractedArchitecture } from "../types";
import type {
  MergePlan,
  ExistingCanvasState,
  GeneratedNode,
} from "./merge-engine-types";

/**
 * Apply a merge plan to produce the final extraction that should be added to canvas.
 * Filters out duplicates and remaps IDs for matched components.
 */
export function applyMergePlan(
  extraction: ExtractedArchitecture,
  plan: MergePlan,
): ExtractedArchitecture {
  const idRemap = new Map<string, string>();
  for (const c of plan.components) {
    if (c.action === "update" && c.matchedNodeId) {
      idRemap.set(c.extracted.id, c.matchedNodeId);
    }
  }

  const newComponents = plan.components
    .filter((c) => c.action === "add")
    .map((c) => c.extracted);

  const newFlows = plan.dataFlows
    .filter((f) => f.action === "add")
    .map((f) => ({
      ...f.extracted,
      sourceId: idRemap.get(f.extracted.sourceId) || f.extracted.sourceId,
      targetId: idRemap.get(f.extracted.targetId) || f.extracted.targetId,
    }));

  const newBoundaries = plan.boundaries
    .filter((b) => b.action === "add")
    .map((b) => {
      const remappedComponentIds = b.extracted.componentIds.map(
        (id) => idRemap.get(id) || id,
      );
      const newCompIds = new Set(newComponents.map((c) => c.id));
      const filteredIds = remappedComponentIds.filter((id) =>
        newCompIds.has(id),
      );
      return { ...b.extracted, componentIds: filteredIds };
    })
    .filter((b) => b.componentIds.length > 0);

  return {
    ...extraction,
    components: newComponents,
    dataFlows: newFlows,
    boundaries: newBoundaries,
  };
}

/** Quick check: does the canvas already have components? */
export function canvasHasComponents(existing: ExistingCanvasState): boolean {
  return existing.nodes.some((n) => n.type !== "boundary");
}

/**
 * Summarize existing canvas components for the AI extraction prompt.
 * Helps the AI avoid re-extracting things already on the canvas.
 */
export function summarizeExistingComponents(nodes: GeneratedNode[]): string {
  const components = nodes.filter((n) => n.type !== "boundary");
  if (components.length === 0) return "";

  const lines = components.map((n) => {
    const tech = n.data.technology ? ` (${n.data.technology})` : "";
    const type = n.data.componentType || "unknown";
    return `- ${n.data.label}${tech} [type: ${type}, id: ${n.id}]`;
  });

  return [
    "EXISTING COMPONENTS ALREADY ON CANVAS:",
    ...lines,
    "",
    "IMPORTANT: If you identify components that match the ones above, use the SAME id.",
    "Only create new components for things NOT already listed above.",
    "Still include all data flows — even those connecting to existing components.",
  ].join("\n");
}
