"use client";

import { useState, useCallback, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import type { ConnectionData } from "@/types/canvas";
import type { SegmentOrientation } from "./path-segments";
import {
  type Pt,
  MIN_SEG_FOR_QUARTER,
  quarterMark,
  ptSegDist,
  nearestSegIdx,
} from "./security-edge-utils";
import { useCanvasStore } from "@/stores/canvas";
import { orthogonalizeWaypoints, simplifyWaypoints } from "./orthogonal-router";

interface PathSegment {
  start: Pt;
  end: Pt;
  midpoint: Pt;
  orientation: SegmentOrientation;
}

interface WaypointHandlersProps {
  id: string;
  lineStyle: string;
  data: ConnectionData | undefined;
  corners: Pt[];
  segments: PathSegment[];
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  setDraggingCorners: (corners: Pt[] | null) => void;
}

export function useEdgeWaypointHandlers({
  id,
  lineStyle,
  data,
  corners,
  segments,
  sourceX,
  sourceY,
  targetX,
  targetY,
  setDraggingCorners,
}: WaypointHandlersProps) {
  const { screenToFlowPosition } = useReactFlow();
  const updateEdgeData = useCanvasStore((s) => s.updateEdgeData);
  const [transientPill, setTransientPill] = useState<{
    x: number;
    y: number;
    orientation: SegmentOrientation;
    segIndex: number;
  } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWaypointUpdate = useCallback(
    (wpts: Pt[]) => setDraggingCorners(wpts),
    [setDraggingCorners],
  );

  const handleWaypointCommit = useCallback(
    (wpts: Pt[]) => {
      try {
        // Square the run, then drop the points the drag made redundant:
        // dragging a segment back into line with its neighbours should REMOVE
        // that corner, not leave a handle sitting on a straight line. Endpoints
        // are included so a waypoint that lines up with the source/target
        // collapses too, then stripped again — only interior points are stored.
        const full = simplifyWaypoints(
          orthogonalizeWaypoints([
            { x: sourceX, y: sourceY },
            ...wpts,
            { x: targetX, y: targetY },
          ]),
        );
        const interior = full.slice(1, -1);
        updateEdgeData(id, {
          // Nothing left to describe means the edge is a plain run again: clear
          // the waypoints so it returns to automatic routing (and resumes
          // avoiding obstacles) instead of freezing the dragged shape.
          waypoints: interior.length
            ? interior.map((c) => ({ ...c, manual: true as const }))
            : null,
        });
      } finally {
        // ALWAYS end the drag, even if the commit throws. This used to run only
        // after a successful commit, so one geometry error left
        // `draggingCorners` set and the line kept following the mouse after
        // mouseup — a stuck canvas rather than one bad edge.
        setDraggingCorners(null);
      }
    },
    [
      id,
      updateEdgeData,
      setDraggingCorners,
      sourceX,
      sourceY,
      targetX,
      targetY,
    ],
  );

  const handleResetWaypoints = useCallback(() => {
    updateEdgeData(id, { waypoints: null });
  }, [id, updateEdgeData]);

  const handleHitPathMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const cursor = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let i = 0; i < segments.length; i++) {
          const d = ptSegDist(cursor, segments[i].start, segments[i].end);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        if (bestIdx === -1) {
          setTransientPill(null);
          return;
        }
        const seg = segments[bestIdx];
        const segLen = Math.hypot(
          seg.end.x - seg.start.x,
          seg.end.y - seg.start.y,
        );
        if (segLen < MIN_SEG_FOR_QUARTER) {
          setTransientPill(null);
          return;
        }
        const qm = quarterMark(seg, cursor);
        if (
          segments.some(
            (s) => Math.hypot(s.midpoint.x - qm.x, s.midpoint.y - qm.y) < 60,
          )
        ) {
          setTransientPill(null);
          return;
        }
        setTransientPill({
          x: qm.x,
          y: qm.y,
          orientation: seg.orientation,
          segIndex: bestIdx,
        });
      }, 50);
    },
    [screenToFlowPosition, segments],
  );

  const handleHitPathMouseLeave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setTransientPill(null);
  }, []);

  const handleAddWaypoint = useCallback(
    (e: React.MouseEvent) => {
      if (!e.altKey || lineStyle !== "smoothstep") return;
      e.stopPropagation();
      const click = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const current = data?.waypoints ?? corners;
      const fullPath = [
        { x: sourceX, y: sourceY },
        ...current,
        { x: targetX, y: targetY },
      ];
      const segIdx = nearestSegIdx(fullPath, click);
      const next = [...current];
      next.splice(segIdx, 0, click);
      updateEdgeData(id, { waypoints: next });
    },
    [
      id,
      lineStyle,
      data?.waypoints,
      corners,
      sourceX,
      sourceY,
      targetX,
      targetY,
      screenToFlowPosition,
      updateEdgeData,
    ],
  );

  return {
    transientPill,
    setTransientPill,
    handleWaypointUpdate,
    handleWaypointCommit,
    handleResetWaypoints,
    handleHitPathMouseMove,
    handleHitPathMouseLeave,
    handleAddWaypoint,
  };
}
