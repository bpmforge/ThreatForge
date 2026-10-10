import type {
  ExtractedArchitecture,
  ExtractedComponent,
  ExtractedDataFlow,
  GeneratedModel,
  GeneratedNode,
  GeneratedEdge,
  LayoutOptions,
} from "../types";

import { autoLayoutNodes } from "./auto-layout";
import {
  getDefaultDescription,
  getDefaultAINotes,
  getDefaultSecurityContext,
} from "./component-defaults";
import { coerceComponentTypeOrCustom } from "@/lib/component-types";
import {
  createBoundaryNodes,
  mapTrustLevel,
  inferAccessPattern,
  COMP_W,
  BOUNDARY_SPACING,
} from "./model-generator-layout";
import { generateSuggestedThreats } from "./model-generator-threats";

export function generateModel(
  extraction: ExtractedArchitecture,
  options?: LayoutOptions,
): GeneratedModel {
  const selectedComponents = extraction.components.filter((c) => c.selected);
  const selectedFlows = extraction.dataFlows.filter((f) => f.selected);
  const selectedBoundaries = (extraction.boundaries || []).filter(
    (b) => b.selected,
  );

  const componentNodes = createNodesFromComponents(selectedComponents);
  const boundaryNodes = createBoundaryNodes(selectedBoundaries, componentNodes);
  const allNodes = [...boundaryNodes, ...componentNodes];
  const edges = createEdgesFromFlows(selectedFlows);

  let layoutedNodes = allNodes;
  if (boundaryNodes.length > 0) {
    let maxBoundaryBottom = 0;
    for (const bn of boundaryNodes) {
      const h = (bn.style?.height as number) || 300;
      maxBoundaryBottom = Math.max(maxBoundaryBottom, 40 + h);
    }
    let orphanIdx = 0;
    for (const node of componentNodes) {
      const hasParent = (node as GeneratedNode & { parentId?: string })
        .parentId;
      if (!hasParent) {
        node.position = {
          x: 40 + orphanIdx * (COMP_W + BOUNDARY_SPACING),
          y: maxBoundaryBottom + 60,
        };
        orphanIdx++;
      }
    }
  } else if (options) {
    layoutedNodes = autoLayoutNodes(allNodes, edges, options);
  }

  const suggestedThreats = generateSuggestedThreats(
    selectedComponents,
    selectedFlows,
    selectedBoundaries,
  );

  return {
    nodes: layoutedNodes,
    edges,
    suggestedThreats,
    layoutType: options?.type || "hierarchical",
  };
}

function createNodesFromComponents(
  components: ExtractedComponent[],
): GeneratedNode[] {
  return components.map((component) => {
    const type = coerceComponentTypeOrCustom(component.type) || "PROCESS";
    const secDefaults = getDefaultSecurityContext(type);
    const classification =
      component.dataClassification?.[0] || secDefaults.dataClassification;
    const accessPattern = inferAccessPattern(
      component.trustLevel,
      secDefaults.accessPattern,
    );

    return {
      id: component.id,
      type: "component",
      position: { x: 0, y: 0 },
      data: {
        label: component.name,
        type,
        componentType: type,
        description: component.description || getDefaultDescription(type),
        technology: component.technology,
        trustLevel: mapTrustLevel(component.trustLevel),
        securityContext: {
          dataClassification: classification,
          dataTypes: component.dataHandled || [],
          accessPattern: accessPattern,
          complianceFrameworks: [],
          existingControls: [],
          technologyVersion: component.technology,
        },
        _extraction: {
          confidence: component.confidence,
          sourceText: component.sourceText,
          sourceDocument: component.sourceDocument,
          aiNotes: component.description || getDefaultAINotes(type),
        },
      },
    };
  });
}

function createEdgesFromFlows(flows: ExtractedDataFlow[]): GeneratedEdge[] {
  return flows.map((flow) => ({
    id: flow.id,
    source: flow.sourceId,
    target: flow.targetId,
    type: "security",
    label: flow.label,
    data: {
      protocol: flow.protocol,
      encrypted: flow.encrypted,
      dataTypes: flow.dataTypes,
      style: { lineStyle: "smoothstep" },
    },
  }));
}
