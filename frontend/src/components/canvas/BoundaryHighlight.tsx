"use client";

/**
 * BoundaryHighlight - Visual overlay for drag-and-drop boundary feedback.
 *
 * Shows a pulsing highlight around the boundary that will receive
 * a dropped node during drag operations.
 */
import { memo } from "react";

interface BoundaryBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BoundaryHighlightProps {
  /** Bounds of the boundary to highlight */
  bounds: BoundaryBounds | null;
  /** Whether the highlight should be visible */
  isActive: boolean;
}

function BoundaryHighlightComponent({
  bounds,
  isActive,
}: BoundaryHighlightProps) {
  if (!isActive || !bounds) {
    return null;
  }

  return (
    <div
      className="absolute animate-pulse bg-blue-500/10 border-2 border-dashed border-blue-400 rounded-xl pointer-events-none z-50"
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
      }}
      aria-hidden="true"
    />
  );
}

export const BoundaryHighlight = memo(BoundaryHighlightComponent);
