"use client";

import { useState, useCallback } from "react";
import type { CanvasNode } from "@/stores/canvas";
import { getAbsolutePosition, getNodeSize } from "@/stores/canvas/geometry";

export interface GuideLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const THRESHOLD = 8;
const PAD = 60;

/**
 * Edge coordinates in ABSOLUTE canvas space. A node inside a trust boundary
 * stores a parent-relative position; comparing that against a top-level
 * node's absolute position produced guides (and snaps) that were off by the
 * boundary's offset.
 */
function getEdges(node: CanvasNode, w: number, h: number, all: CanvasNode[]) {
  const { x, y } = getAbsolutePosition(node, all);
  return {
    left: x,
    right: x + w,
    centerX: x + w / 2,
    top: y,
    bottom: y + h,
    centerY: y + h / 2,
  };
}

/** Pure — compute snap offsets for a dragging node against its siblings */
export function computeSnapOffsets(
  dragging: CanvasNode,
  all: CanvasNode[],
): { snapX: number | null; snapY: number | null } {
  const { width: dW, height: dH } = getNodeSize(dragging);
  const d = getEdges(dragging, dW, dH, all);

  let bestX: number | null = null;
  let bestXDelta = Infinity;
  let bestY: number | null = null;
  let bestYDelta = Infinity;

  for (const node of all) {
    if (node.id === dragging.id || node.type === "boundary") continue;
    const { width: nW, height: nH } = getNodeSize(node);
    const n = getEdges(node, nW, nH, all);

    const xPairs: [number, number][] = [
      [d.left, n.left],
      [d.right, n.right],
      [d.centerX, n.centerX],
      [d.left, n.right],
      [d.right, n.left],
    ];
    for (const [dX, nX] of xPairs) {
      const delta = nX - dX;
      if (Math.abs(delta) <= THRESHOLD && Math.abs(delta) < bestXDelta) {
        bestX = delta;
        bestXDelta = Math.abs(delta);
      }
    }

    const yPairs: [number, number][] = [
      [d.top, n.top],
      [d.bottom, n.bottom],
      [d.centerY, n.centerY],
      [d.top, n.bottom],
      [d.bottom, n.top],
    ];
    for (const [dY, nY] of yPairs) {
      const delta = nY - dY;
      if (Math.abs(delta) <= THRESHOLD && Math.abs(delta) < bestYDelta) {
        bestY = delta;
        bestYDelta = Math.abs(delta);
      }
    }
  }

  return { snapX: bestX, snapY: bestY };
}

/** Snapped position returned alongside guide lines from computeGuides */
interface SnappedPosition {
  x: number;
  y: number;
}

interface UseAlignmentGuidesReturn {
  guides: GuideLine[];
  computeGuides: (
    dragging: CanvasNode,
    all: CanvasNode[],
  ) => SnappedPosition | null;
  clearGuides: () => void;
}

export function useAlignmentGuides(): UseAlignmentGuidesReturn {
  const [guides, setGuides] = useState<GuideLine[]>([]);

  const computeGuides = useCallback(
    (dragging: CanvasNode, all: CanvasNode[]): SnappedPosition | null => {
      const { width: dW, height: dH } = getNodeSize(dragging);
      const d = getEdges(dragging, dW, dH, all);

      const lines: GuideLine[] = [];

      // Track best snap deltas alongside guide collection
      let bestSnapX: number | null = null;
      let bestSnapXDelta = Infinity;
      let bestSnapY: number | null = null;
      let bestSnapYDelta = Infinity;

      for (const node of all) {
        if (node.id === dragging.id || node.type === "boundary") continue;
        const { width: nW, height: nH } = getNodeSize(node);
        const n = getEdges(node, nW, nH, all);

        const minY = Math.min(d.top, n.top) - PAD;
        const maxY = Math.max(d.bottom, n.bottom) + PAD;
        const minX = Math.min(d.left, n.left) - PAD;
        const maxX = Math.max(d.right, n.right) + PAD;

        const xPairs: [number, number][] = [
          [d.left, n.left],
          [d.right, n.right],
          [d.centerX, n.centerX],
          [d.left, n.right],
          [d.right, n.left],
        ];
        for (const [dX, nX] of xPairs) {
          const delta = Math.abs(dX - nX);
          if (delta <= THRESHOLD) {
            lines.push({ x1: nX, y1: minY, x2: nX, y2: maxY });
            if (delta < bestSnapXDelta) {
              bestSnapXDelta = delta;
              bestSnapX = nX - dX; // how much to shift dragging.x
            }
          }
        }

        const yPairs: [number, number][] = [
          [d.top, n.top],
          [d.bottom, n.bottom],
          [d.centerY, n.centerY],
          [d.top, n.bottom],
          [d.bottom, n.top],
        ];
        for (const [dY, nY] of yPairs) {
          const delta = Math.abs(dY - nY);
          if (delta <= THRESHOLD) {
            lines.push({ x1: minX, y1: nY, x2: maxX, y2: nY });
            if (delta < bestSnapYDelta) {
              bestSnapYDelta = delta;
              bestSnapY = nY - dY; // how much to shift dragging.y
            }
          }
        }
      }

      setGuides(lines);

      if (bestSnapX !== null || bestSnapY !== null) {
        return {
          x: dragging.position.x + (bestSnapX ?? 0),
          y: dragging.position.y + (bestSnapY ?? 0),
        };
      }
      return null;
    },
    [],
  );

  const clearGuides = useCallback(() => setGuides([]), []);

  return { guides, computeGuides, clearGuides };
}
