"use client";

import { useMemo, useCallback } from "react";
import { Position, useNodes, useEdges } from "@xyflow/react";
import type { ConnectionData, EdgeStyle } from "@/types/canvas";
import {
  parsePathSegments,
  findHorizontalCrossings,
  insertLineJumps,
} from "./line-jumps";
import {
  waypointsToSvg,
  orthogonalizeWaypoints,
  simplifyWaypoints,
} from "./orthogonal-router";
import { extractSegments, pointAt, closestT } from "./path-segments";
import { computeLabelDodge } from "./collision";
import {
  type Pt,
  buildAvoidancePath,
  getPathForStyle,
  applyCornerRadius,
  extractCorners,
  getEdgeStyle,
  getSecurityLevel,
} from "./security-edge-utils";
import { useCanvasStore } from "@/stores/canvas";
import {
  getCachedObstacles,
  getEdgeGeometryIndex,
  type EdgeGeometry,
} from "./edge-geometry-cache";

interface EdgePathComputationProps {
  id: string;
  sourceX: number;
  sourceY: number;
  sourcePosition: Position;
  targetX: number;
  targetY: number;
  targetPosition: Position;
  lineStyle: string;
  draggingCorners: Pt[] | null;
  data: ConnectionData | undefined;
}

export function useEdgePathComputation({
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
}: EdgePathComputationProps) {
  const nodes = useNodes();
  const allEdges = useEdges();
  const updateEdgeData = useCanvasStore((s) => s.updateEdgeData);

  // The single waypoint list everything downstream agrees on.
  //
  // `corners` drives the drag handles and `segments` carries the
  // `waypointIndex` those handles write back through (usePillDragHandlers does
  // `live[wpIdx] = pos`). If the two are derived from DIFFERENT lists the
  // indices drift apart, and an index past the end produces a sparse array —
  // a hole that reaches the router as `undefined` and throws. So simplify once,
  // here, and let every consumer read the same array.
  //
  // Mid-drag this holds the RAW points — the DRAG MODEL. The handle must stay
  // under the cursor while it is being moved, and the active drag writes to a
  // fixed index (`live[wpIdx] = pos`), so this list must not shift beneath it.
  // The drawn path is simplified separately (see `edgePath`), which is what
  // makes the line collapse live without disturbing the drag.
  const effectiveWaypoints = useMemo((): Pt[] | null => {
    const manual = draggingCorners ?? data?.waypoints ?? null;
    if (!manual || manual.length === 0) return null;
    const clean = manual.filter(
      (p): p is Pt => !!p && Number.isFinite(p.x) && Number.isFinite(p.y),
    );
    if (clean.length === 0) return null;
    if (draggingCorners) return clean;
    return simplifyWaypoints(
      orthogonalizeWaypoints([
        { x: sourceX, y: sourceY },
        ...clean,
        { x: targetX, y: targetY },
      ]),
    ).slice(1, -1);
  }, [draggingCorners, data?.waypoints, sourceX, sourceY, targetX, targetY]);

  const [edgePath, labelX, labelY] = useMemo(() => {
    if (lineStyle === "smoothstep") {
      if (effectiveWaypoints && effectiveWaypoints.length > 0) {
        // Square off diagonals, then collapse redundant corners — ALWAYS,
        // including mid-drag, so the line straightens the instant a segment
        // comes into line instead of waiting for mouseup. This is display only:
        // `effectiveWaypoints` (the drag model) is left untouched, so the
        // dragged handle keeps its index and stays under the cursor.
        //
        // Safe because extractSegments maps waypoints to segments by
        // COORDINATE, not by position — a point collapsed out of the drawn path
        // simply stops matching, rather than shifting another point's index.
        return waypointsToSvg(
          simplifyWaypoints(
            orthogonalizeWaypoints([
              { x: sourceX, y: sourceY },
              ...effectiveWaypoints,
              { x: targetX, y: targetY },
            ]),
          ),
        );
      }
      return buildAvoidancePath(
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        nodes,
        getCachedObstacles(nodes),
      );
    }
    return getPathForStyle(lineStyle as EdgeStyle, {
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
  }, [
    lineStyle,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    nodes,
    effectiveWaypoints,
  ]);

  const corners = useMemo((): Pt[] => {
    if (lineStyle !== "smoothstep") return [];
    if (effectiveWaypoints) return effectiveWaypoints;
    return extractCorners(edgePath);
  }, [lineStyle, edgePath, effectiveWaypoints]);

  // Same list as `corners`, so a segment's `waypointIndex` always addresses a
  // real element of what the handles display. Reading a different list here is
  // what produced `live[wpIdx] = pos` on an out-of-range index — a sparse array
  // whose hole reached the router as `undefined`.
  const segments = useMemo(() => {
    return extractSegments(edgePath, effectiveWaypoints ?? undefined);
  }, [edgePath, effectiveWaypoints]);

  // Geometry of every OTHER edge — from the shared per-commit index, so the
  // whole canvas computes each edge's route ONCE per node change instead of
  // every edge re-routing every other edge (O(E²·A*)).
  const otherEdges = useMemo(() => {
    const index = getEdgeGeometryIndex(nodes, allEdges);
    const out: EdgeGeometry[] = [];
    for (const g of index.values()) if (g.id !== id) out.push(g);
    return out;
  }, [allEdges, nodes, id]);

  const finalPath = useMemo(() => {
    if (draggingCorners !== null) return edgePath;
    const mySegs = parsePathSegments(edgePath);
    if (mySegs.length === 0) return edgePath;
    const allCrossings: Pt[] = [];
    for (const other of otherEdges) {
      allCrossings.push(...findHorizontalCrossings(mySegs, other.segments));
    }
    return insertLineJumps(edgePath, allCrossings);
  }, [edgePath, otherEdges, draggingCorners]);

  const displayPath = useMemo(() => {
    const cr = data?.cornerRadius ?? 0;
    if (
      cr > 0 &&
      (lineStyle === "step" ||
        lineStyle === "smoothstep" ||
        lineStyle === "straight")
    ) {
      return applyCornerRadius(finalPath, cr);
    }
    return finalPath;
  }, [finalPath, data?.cornerRadius, lineStyle]);

  const baseStyle = getEdgeStyle(data);
  const style = useMemo(
    () => ({
      stroke: data?.style?.strokeColor || baseStyle.stroke,
      strokeDasharray: baseStyle.strokeDasharray,
      strokeWidth: data?.style?.strokeWidth || baseStyle.strokeWidth,
    }),
    [data?.style, baseStyle],
  );

  const effectiveLabelPos = useMemo(() => {
    const t = data?.labelPosition;
    if (t != null) return pointAt(edgePath, t);
    return { x: labelX, y: labelY };
  }, [data?.labelPosition, edgePath, labelX, labelY]);

  // Labels of lines that run together (a request/response pair, two flows
  // sharing a corridor) land on the same spot; spread them apart. Every edge
  // used to be given THIS edge's midpoint, which put all labels in one
  // cluster and shifted them off their own lines at random.
  const collisionDodgeY = useMemo((): number => {
    if (data?.labelOffset && data.labelOffset !== "center") return 0;
    const placements = [
      {
        edgeId: id,
        midpoint: effectiveLabelPos,
        offset: (data?.labelOffset ?? null) as
          | "above"
          | "center"
          | "below"
          | null,
      },
      ...otherEdges.map((o) => ({
        edgeId: o.id,
        midpoint: o.label,
        offset: o.labelOffset,
      })),
    ];
    return (
      computeLabelDodge(placements).find((d) => d.edgeId === id)?.perp ?? 0
    );
  }, [otherEdges, id, effectiveLabelPos, data?.labelOffset]);

  const handleLabelDrag = useCallback(
    (flowPos: { x: number; y: number }) => {
      updateEdgeData(id, { labelPosition: closestT(edgePath, flowPos) });
    },
    [edgePath, id, updateEdgeData],
  );

  return {
    edgePath,
    labelX,
    labelY,
    corners,
    segments,
    finalPath,
    displayPath,
    style,
    baseStyle,
    security: getSecurityLevel(data),
    threatCount: data?.threats?.length ?? 0,
    hasManualWaypoints: !!data?.waypoints,
    effectiveLabelPos,
    collisionDodgeY,
    handleLabelDrag,
  };
}
