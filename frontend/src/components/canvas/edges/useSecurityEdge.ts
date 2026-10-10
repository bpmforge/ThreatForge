"use client";

import { useState, useCallback } from "react";
import { Position } from "@xyflow/react";
import type { ConnectionData } from "@/types/canvas";
import { useCanvasStore } from "@/stores/canvas";
import { type Pt } from "./security-edge-utils";
import { useEdgePathComputation } from "./useEdgePathComputation";
import { useEdgeWaypointHandlers } from "./useEdgeWaypointHandlers";

interface SecurityEdgeProps {
  id: string;
  source: string;
  target: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  data: ConnectionData | undefined;
  selected?: boolean;
}

export function useSecurityEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: SecurityEdgeProps) {
  const updateEdgeData = useCanvasStore((s) => s.updateEdgeData);
  // Two booleans instead of hoveredNodeId itself, so moving the hover between
  // nodes re-renders only the edges whose highlight/dim state flips.
  const isHighlighted = useCanvasStore(
    (s) => s.hoveredNodeId === source || s.hoveredNodeId === target,
  );
  const anyNodeHovered = useCanvasStore((s) => !!s.hoveredNodeId);
  const [draggingCorners, setDraggingCorners] = useState<Pt[] | null>(null);

  // Orthogonal lock (Lucid-style): every edge routes strictly horizontal/
  // vertical. "smoothstep" is the codebase's rich orthogonal mode — despite the
  // name it renders SHARP 90° corners (waypointsToSvg emits plain M/L
  // polylines), routes around nodes (findOrthogonalRoute) and supports
  // draggable waypoints. Curved/diagonal styles (bezier, straight) and the
  // plain `step` fallback are collapsed into it so EXISTING saved edges become
  // orthogonal with no data migration — the stored `lineStyle` is left intact,
  // so removing this line restores the old per-edge rendering.
  const lineStyle = "smoothstep";
  const isDimmed = anyNodeHovered && !isHighlighted;

  const handleLabelChange = useCallback(
    (label: string) => updateEdgeData(id, { label }),
    [id, updateEdgeData],
  );

  const pathResult = useEdgePathComputation({
    id,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    lineStyle,
    draggingCorners,
    data,
  });

  const waypointHandlers = useEdgeWaypointHandlers({
    id,
    lineStyle,
    data,
    corners: pathResult.corners,
    segments: pathResult.segments,
    sourceX,
    sourceY,
    targetX,
    targetY,
    setDraggingCorners,
  });

  return {
    lineStyle,
    isHighlighted,
    isDimmed,
    draggingCorners,
    setDraggingCorners,
    handleLabelChange,
    updateEdgeData,
    ...pathResult,
    ...waypointHandlers,
  };
}
