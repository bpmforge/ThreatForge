"use client";

/**
 * ShiftSnapConnectionLine — the React Flow connection preview drawn while the
 * user drags a new edge.
 *
 * Orthogonal lock: the preview draws strictly horizontal/vertical, matching how
 * the edge will actually render once dropped (useSecurityEdge pins every edge to
 * the orthogonal router). It previously drew a bezier, so the line curved and
 * angled mid-drag and then snapped square on release — the preview disagreeing
 * with the result is what reads as "it draws at angles".
 *
 * Shift-snap is kept for the floating endpoint: it constrains the cursor point
 * (45° increments), which under an orthogonal preview lands as a clean
 * horizontal or vertical run.
 */
import {
  getSmoothStepPath,
  type ConnectionLineComponentProps,
} from "@xyflow/react";
import { useShiftSnap } from "@/hooks/useShiftSnap";

export function ShiftSnapConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  connectionLineStyle,
}: ConnectionLineComponentProps) {
  const { maybeSnap } = useShiftSnap();
  const snapped = maybeSnap({ x: fromX, y: fromY }, { x: toX, y: toY });

  // borderRadius: 0 → sharp 90° corners, same geometry as the dropped edge.
  const [path] = getSmoothStepPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: snapped.x,
    targetY: snapped.y,
    targetPosition: toPosition,
    borderRadius: 0,
  });

  return (
    <path
      d={path}
      fill="none"
      stroke="#b1b1b7"
      strokeWidth={2}
      strokeDasharray="5,5"
      style={connectionLineStyle}
      className="animated"
    />
  );
}
