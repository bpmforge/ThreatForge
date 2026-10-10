import {
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  Position,
  type Edge,
  type Node,
} from "@xyflow/react";
import type { ConnectionData, EdgeStyle } from "@/types/canvas";
import {
  findOrthogonalRoute,
  waypointsToSvg,
  type RouteSide,
} from "./orthogonal-router";
import { parsePathSegments } from "./line-jumps";

export type Pt = { x: number; y: number };

const NODE_W = 160;
const NODE_H = 60;
const BOUNDARY_HEADER_H = 40;
export const MIN_SEG_FOR_QUARTER = 120;

export function getEdgeStyle(data: ConnectionData | undefined) {
  const encrypted = data?.encrypted ?? false;
  const crossesBoundary = data?.crossesBoundary ?? false;
  const auth = data?.authentication;
  const threatCount = data?.threats?.length ?? 0;
  const hasUnmitigatedThreats =
    data?.threats?.some((t) => !t.mitigated) ?? false;

  let stroke = "#6b7280";
  if (crossesBoundary) stroke = "#f97316";
  if (auth === "None" && crossesBoundary) stroke = "#ef4444";
  if (hasUnmitigatedThreats) stroke = "#ef4444";

  const strokePatternOverride = data?.strokePattern;
  let strokeDasharray: string | undefined;
  if (strokePatternOverride === "dashed") strokeDasharray = "5,5";
  else if (strokePatternOverride === "dotted") strokeDasharray = "2,3";
  else if (strokePatternOverride === "solid") strokeDasharray = undefined;
  else strokeDasharray = encrypted ? undefined : "5,5";

  return { stroke, strokeDasharray, strokeWidth: threatCount > 0 ? 3 : 2 };
}

export function getSecurityLevel(data: ConnectionData | undefined): {
  level: "high" | "medium" | "low" | "critical";
  color: string;
} {
  const encrypted = data?.encrypted ?? false;
  const auth = data?.authentication;
  if (!encrypted) return { level: "critical", color: "#ef4444" };
  if (auth === "mTLS" || auth === "OAuth2")
    return { level: "high", color: "#22c55e" };
  if (auth === "JWT" || auth === "API_KEY")
    return { level: "medium", color: "#eab308" };
  return { level: "low", color: "#f97316" };
}

function absolutePos(
  n: Node,
  nodeMap: Map<string, Node>,
): { x: number; y: number } {
  const pid = (n as Node & { parentId?: string }).parentId;
  if (pid) {
    const parent = nodeMap.get(pid);
    if (parent) {
      const parentAbs = absolutePos(parent, nodeMap);
      return { x: parentAbs.x + n.position.x, y: parentAbs.y + n.position.y };
    }
  }
  return { x: n.position.x, y: n.position.y };
}

export function getObstacles(nodes: Node[], excludeIds?: string[]) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const result: { x: number; y: number; width: number; height: number }[] = [];
  for (const n of nodes) {
    if (excludeIds?.includes(n.id)) continue;
    const pos = absolutePos(n, nodeMap);
    if (n.type === "component") {
      result.push({
        x: pos.x,
        y: pos.y,
        width: n.measured?.width ?? n.width ?? NODE_W,
        height: n.measured?.height ?? n.height ?? NODE_H,
      });
    } else if (n.type === "boundary") {
      result.push({
        x: pos.x,
        y: pos.y,
        width: n.measured?.width ?? n.width ?? 300,
        height: BOUNDARY_HEADER_H,
      });
    }
  }
  return result;
}

export function toRouteSide(pos: Position): RouteSide {
  switch (pos) {
    case Position.Left:
      return "left";
    case Position.Top:
      return "top";
    case Position.Bottom:
      return "bottom";
    default:
      return "right";
  }
}

/**
 * Obstacles that can influence a route between two points: those touching
 * the endpoints' bounding box grown by `margin`. A route through one corner
 * of a large diagram must not build an A* grid over every node in it.
 */
export function cullObstacles(
  obstacles: { x: number; y: number; width: number; height: number }[],
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  margin = 240,
) {
  const minX = Math.min(sourceX, targetX) - margin;
  const maxX = Math.max(sourceX, targetX) + margin;
  const minY = Math.min(sourceY, targetY) - margin;
  const maxY = Math.max(sourceY, targetY) + margin;
  return obstacles.filter(
    (o) =>
      o.x + o.width >= minX &&
      o.x <= maxX &&
      o.y + o.height >= minY &&
      o.y <= maxY,
  );
}

export function buildAvoidancePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
  nodes: Node[],
  obstacles: {
    x: number;
    y: number;
    width: number;
    height: number;
  }[] = getObstacles(nodes),
): [string, number, number] {
  const waypoints = findOrthogonalRoute(
    sourceX,
    sourceY,
    targetX,
    targetY,
    cullObstacles(obstacles, sourceX, sourceY, targetX, targetY),
    12,
    toRouteSide(sourcePosition),
    toRouteSide(targetPosition),
  );
  return waypointsToSvg(waypoints);
}

export function getEdgeEndpoints(edge: Edge, nodes: Node[]) {
  const src = nodes.find((n) => n.id === edge.source);
  const tgt = nodes.find((n) => n.id === edge.target);
  if (!src || !tgt) return null;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const srcPos = absolutePos(src, nodeMap);
  const tgtPos = absolutePos(tgt, nodeMap);
  const sw = src.measured?.width ?? src.width ?? 160;
  const sh = src.measured?.height ?? src.height ?? 60;
  const th = tgt.measured?.height ?? tgt.height ?? 60;
  return {
    sourceX: srcPos.x + sw,
    sourceY: srcPos.y + sh / 2,
    targetX: tgtPos.x,
    targetY: tgtPos.y + th / 2,
  };
}

export function getPathForStyle(
  lineStyle: EdgeStyle,
  params: {
    sourceX: number;
    sourceY: number;
    sourcePosition: Position;
    targetX: number;
    targetY: number;
    targetPosition: Position;
  },
): [string, number, number] {
  const { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition } =
    params;
  let result: [string, number, number, number, number];
  switch (lineStyle) {
    case "straight":
      result = getStraightPath({ sourceX, sourceY, targetX, targetY });
      break;
    case "step":
      result = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 0,
      });
      break;
    case "smoothstep":
      result = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 12,
        offset: 25,
      });
      break;
    case "bezier":
    default:
      result = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      });
      break;
  }
  return [result[0], result[1], result[2]];
}

export function applyCornerRadius(d: string, r: number): string {
  if (r <= 0) return d;
  const tokens = d.match(/[MLHVCZ][^MLHVCZ]*/gi);
  if (!tokens) return d;
  const pts: Pt[] = [];
  for (const tok of tokens) {
    const cmd = tok[0].toUpperCase();
    const nums = tok
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (cmd === "M" || cmd === "L") pts.push({ x: nums[0], y: nums[1] });
  }
  if (pts.length < 3) return d;
  let out = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1],
      cur = pts[i],
      next = pts[i + 1];
    const d1 = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const d2 = Math.hypot(next.x - cur.x, next.y - cur.y);
    const cr = Math.min(r, d1 / 2, d2 / 2);
    const t1 = 1 - cr / d1,
      t2 = cr / d2;
    const p1 = {
      x: prev.x + t1 * (cur.x - prev.x),
      y: prev.y + t1 * (cur.y - prev.y),
    };
    const p2 = {
      x: cur.x + t2 * (next.x - cur.x),
      y: cur.y + t2 * (next.y - cur.y),
    };
    out += ` L ${p1.x} ${p1.y} Q ${cur.x} ${cur.y} ${p2.x} ${p2.y}`;
  }
  out += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return out;
}

export function extractCorners(d: string): Pt[] {
  const segs = parsePathSegments(d);
  if (segs.length < 2) return [];
  return segs.slice(0, -1).map((s) => s.to);
}

export function quarterMark(seg: { start: Pt; end: Pt }, cursor: Pt): Pt {
  const { start, end } = seg;
  const q1 = {
    x: start.x + 0.25 * (end.x - start.x),
    y: start.y + 0.25 * (end.y - start.y),
  };
  const q3 = {
    x: start.x + 0.75 * (end.x - start.x),
    y: start.y + 0.75 * (end.y - start.y),
  };
  return Math.hypot(cursor.x - q1.x, cursor.y - q1.y) <=
    Math.hypot(cursor.x - q3.x, cursor.y - q3.y)
    ? q1
    : q3;
}

export function ptSegDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq),
  );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function nearestSegIdx(pts: Pt[], p: Pt): number {
  let best = 0,
    bestD = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = ptSegDist(p, pts[i], pts[i + 1]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
