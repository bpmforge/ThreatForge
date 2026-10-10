import type { GeneratedNode, GeneratedEdge, LayoutOptions } from "../types";

/**
 * Auto-layout service for organizing nodes in a hierarchical grid layout
 */

/**
 * Assigns tiers to nodes based on component type
 */
const getTierForComponent = (componentType: string): number => {
  const tier0Types: string[] = ["client", "actor"];
  const tier1Types: string[] = ["apiGateway", "loadBalancer"];
  const tier2Types: string[] = ["api", "service", "webServer"];
  const tier3Types: string[] = ["database", "cache", "storage", "queue"];

  if (tier0Types.includes(componentType)) return 0;
  if (tier1Types.includes(componentType)) return 1;
  if (tier2Types.includes(componentType)) return 2;
  if (tier3Types.includes(componentType)) return 3;

  // Default to tier 2 for unknown types
  return 2;
};

/**
 * Auto-layout nodes in a tiered hierarchical grid
 */
export function autoLayoutNodes(
  nodes: GeneratedNode[],
  edges: GeneratedEdge[],
  options?: LayoutOptions,
): GeneratedNode[] {
  // Group nodes by tier
  const tiers: Record<number, GeneratedNode[]> = {};

  nodes.forEach((node) => {
    const tier = getTierForComponent(node.data.componentType || "service");
    if (!tiers[tier]) {
      tiers[tier] = [];
    }
    tiers[tier].push(node);
  });

  // Sort nodes within each tier by name for consistent positioning
  Object.values(tiers).forEach((tierNodes) => {
    tierNodes.sort((a, b) =>
      (a.data.label || "").localeCompare(b.data.label || ""),
    );
  });

  // Position nodes in grid
  const positionedNodes: GeneratedNode[] = [];
  const spacingX = options?.spacing?.x || 250;
  const spacingY = options?.spacing?.y || 150;

  Object.entries(tiers).forEach(([tierStr, tierNodes]) => {
    const tier = parseInt(tierStr);
    tierNodes.forEach((node, index) => {
      positionedNodes.push({
        ...node,
        position: {
          x: tier * spacingX,
          y: index * spacingY,
        },
      });
    });
  });

  return positionedNodes;
}
