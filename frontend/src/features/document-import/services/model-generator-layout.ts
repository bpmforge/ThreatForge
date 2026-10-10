import type { ExtractedBoundary, GeneratedNode } from "../types";

const TRUST_LEVEL_MAP: Record<string, { trustLevel: string; color: string }> = {
  PUBLIC: { trustLevel: "PUBLIC", color: "#4ade80" },
  INTERNAL: { trustLevel: "INTERNAL", color: "#60a5fa" },
  CONFIDENTIAL: { trustLevel: "CONFIDENTIAL", color: "#fbbf24" },
  RESTRICTED: { trustLevel: "RESTRICTED", color: "#f87171" },
};

export function mapTrustLevel(level?: string): string {
  if (!level) return "MEDIUM";
  const upper = level.toUpperCase();
  if (upper === "UNTRUSTED" || upper === "LOW") return "LOW";
  if (upper === "HIGH" || upper === "CRITICAL") return "HIGH";
  return "MEDIUM";
}

export function inferAccessPattern(
  trustLevel?: string,
  defaultPattern?: string,
): string {
  if (!trustLevel) return defaultPattern || "INTERNAL_ONLY";
  const upper = trustLevel.toUpperCase();
  if (upper === "UNTRUSTED") return "PUBLIC_INTERNET";
  if (upper === "LOW") return defaultPattern || "AUTHENTICATED_USERS";
  return defaultPattern || "INTERNAL_ONLY";
}

export const COMP_W = 160;
const COMP_H = 60;
const BOUNDARY_PAD = 50;
const BOUNDARY_GAP_X = 60;
const BOUNDARY_GAP_Y = 50;
const BOUNDARY_TITLE_H = 45;
export const BOUNDARY_SPACING = 80;

function boundaryCols(childCount: number): number {
  if (childCount <= 2) return 1;
  if (childCount <= 6) return 2;
  return 3;
}

function boundaryDimensions(childCount: number): {
  width: number;
  height: number;
} {
  const cols = boundaryCols(childCount);
  const rows = Math.ceil(childCount / cols);
  return {
    width: BOUNDARY_PAD * 2 + cols * COMP_W + (cols - 1) * BOUNDARY_GAP_X,
    height:
      BOUNDARY_TITLE_H +
      BOUNDARY_PAD * 2 +
      rows * COMP_H +
      (rows - 1) * BOUNDARY_GAP_Y,
  };
}

export function createBoundaryNodes(
  boundaries: ExtractedBoundary[],
  componentNodes: GeneratedNode[],
): GeneratedNode[] {
  if (!boundaries.length) return [];

  const boundaryNodes: GeneratedNode[] = [];
  const nodeMap = new Map(componentNodes.map((n) => [n.id, n]));

  let cursorX = 40;

  boundaries.forEach((boundary) => {
    const trustConfig =
      TRUST_LEVEL_MAP[boundary.trustLevel || "INTERNAL"] ||
      TRUST_LEVEL_MAP.INTERNAL;

    const childIds = boundary.componentIds || [];
    const childCount = childIds.filter((id) => nodeMap.has(id)).length;
    const size = boundaryDimensions(Math.max(childCount, 1));

    const boundaryNode: GeneratedNode = {
      id: boundary.id,
      type: "boundary",
      position: { x: cursorX, y: 40 },
      data: {
        label: boundary.name,
        type: "TRUST_BOUNDARY",
        componentType: "TRUST_BOUNDARY",
        trustLevel: trustConfig.trustLevel,
        color: trustConfig.color,
        opacity: 30,
        description: boundary.description,
      },
      style: {
        width: size.width,
        height: size.height,
      },
    };
    boundaryNodes.push(boundaryNode);
    cursorX += size.width + BOUNDARY_SPACING;

    const cols = boundaryCols(childCount);
    let childIdx = 0;
    for (const componentId of childIds) {
      const node = nodeMap.get(componentId);
      if (node) {
        (node as GeneratedNode & { parentId?: string }).parentId = boundary.id;
        const col = childIdx % cols;
        const row = Math.floor(childIdx / cols);
        node.position = {
          x: BOUNDARY_PAD + col * (COMP_W + BOUNDARY_GAP_X),
          y: BOUNDARY_TITLE_H + BOUNDARY_PAD + row * (COMP_H + BOUNDARY_GAP_Y),
        };
        childIdx++;
      }
    }
  });

  return boundaryNodes;
}
