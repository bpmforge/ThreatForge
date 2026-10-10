/**
 * Shared, per-commit geometry for every edge on the canvas.
 *
 * Each SecurityEdge needs the drawn path of EVERY OTHER edge (for line jumps
 * at crossings and for label collision dodging). Computing that inside each
 * edge's own memo made one node move cost O(E² · A*): every edge re-routed
 * every other edge. React Flow hands all edges the same `nodes` / `edges`
 * array identities within a commit, so the index is computed once per pair
 * and shared — identity-keyed WeakMaps mean no invalidation bookkeeping and
 * no leaks.
 *
 * Also caches the obstacle rects (one pass over the nodes per commit) and
 * culls obstacles to an edge's neighbourhood before A* so a route through
 * one corner of a large diagram does not scan the whole diagram's grid.
 */
import { Position, type Edge, type Node } from "@xyflow/react";
import type { ConnectionData } from "@/types/canvas";
import { parsePathSegments } from "./line-jumps";

type PathSegment = ReturnType<typeof parsePathSegments>[number];
import { pointAt } from "./path-segments";
import {
  orthogonalizeWaypoints,
  simplifyWaypoints,
  waypointsToSvg,
} from "./orthogonal-router";
import {
  type Pt,
  buildAvoidancePath,
  getEdgeEndpoints,
  getObstacles,
  getPathForStyle,
} from "./security-edge-utils";

export interface EdgeGeometry {
  id: string;
  path: string;
  segments: PathSegment[];
  label: Pt;
  labelOffset: "above" | "center" | "below" | null;
}

type Rect = { x: number; y: number; width: number; height: number };

const obstacleCache = new WeakMap<Node[], Rect[]>();

/** Obstacle rects for a nodes array, computed once per array identity. */
export function getCachedObstacles(nodes: Node[]): Rect[] {
  let rects = obstacleCache.get(nodes);
  if (!rects) {
    rects = getObstacles(nodes);
    obstacleCache.set(nodes, rects);
  }
  return rects;
}

const isFinitePt = (p: unknown): p is Pt =>
  !!p && Number.isFinite((p as Pt).x) && Number.isFinite((p as Pt).y);

/**
 * The geometry of one edge as the canvas draws it, from its stored data.
 * Uses the right→left endpoint approximation for edges we are not rendering
 * ourselves (same as before — React Flow only tells an edge its OWN handle
 * coordinates).
 */
function computeEdgeGeometry(
  edge: Edge,
  nodes: Node[],
  obstacles: Rect[] = getCachedObstacles(nodes),
): EdgeGeometry | null {
  const endpoints = getEdgeEndpoints(edge, nodes);
  if (!endpoints) return null;
  const data = edge.data as ConnectionData | undefined;
  const lineStyle = data?.style?.lineStyle ?? "bezier";
  let tuple: [string, number, number];
  if (lineStyle === "smoothstep") {
    const manual = (data?.waypoints ?? []).filter(isFinitePt);
    if (manual.length > 0) {
      tuple = waypointsToSvg(
        simplifyWaypoints(
          orthogonalizeWaypoints([
            { x: endpoints.sourceX, y: endpoints.sourceY },
            ...manual,
            { x: endpoints.targetX, y: endpoints.targetY },
          ]),
        ),
      );
    } else {
      tuple = buildAvoidancePath(
        endpoints.sourceX,
        endpoints.sourceY,
        endpoints.targetX,
        endpoints.targetY,
        Position.Right,
        Position.Left,
        nodes,
        obstacles,
      );
    }
  } else {
    tuple = getPathForStyle(lineStyle, {
      ...endpoints,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });
  }
  const [path, lx, ly] = tuple;
  const t = data?.labelPosition;
  return {
    id: edge.id,
    path,
    segments: parsePathSegments(path),
    label: t != null ? pointAt(path, t) : { x: lx, y: ly },
    labelOffset: data?.labelOffset ?? null,
  };
}

const indexCache = new WeakMap<
  Node[],
  WeakMap<Edge[], Map<string, EdgeGeometry>>
>();

/**
 * Geometry of every edge, keyed by id — computed once per (nodes, edges)
 * identity pair and shared by all edges rendering in that commit.
 */
export function getEdgeGeometryIndex(
  nodes: Node[],
  edges: Edge[],
): Map<string, EdgeGeometry> {
  let byEdges = indexCache.get(nodes);
  if (!byEdges) {
    byEdges = new WeakMap();
    indexCache.set(nodes, byEdges);
  }
  let index = byEdges.get(edges);
  if (!index) {
    index = new Map();
    const obstacles = getCachedObstacles(nodes);
    for (const edge of edges) {
      const g = computeEdgeGeometry(edge, nodes, obstacles);
      if (g) index.set(edge.id, g);
    }
    byEdges.set(edges, index);
  }
  return index;
}
