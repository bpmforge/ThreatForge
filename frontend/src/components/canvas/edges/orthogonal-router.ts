/**
 * Orthogonal A* Router
 *
 * Grid-based pathfinding that routes edges around ALL components.
 * Same approach used by draw.io, Visio, and Lucidchart.
 *
 * Rules:
 * - Lines EXIT source from the RIGHT handle → first segment goes right
 * - Lines ENTER target on the LEFT handle → last segment comes from the left
 * - Lines NEVER pass through any component (with padding)
 * - Lines can have multiple jogs (H/V/H/V/H...) to route around obstacles
 */

interface Point {
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Check if an orthogonal segment crosses a rectangle (with padding) */
function segmentHitsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: Rect,
  pad: number,
): boolean {
  const left = rect.x - pad;
  const right = rect.x + rect.width + pad;
  const top = rect.y - pad;
  const bottom = rect.y + rect.height + pad;

  const isH = Math.abs(y1 - y2) < 0.5;
  const isV = Math.abs(x1 - x2) < 0.5;

  if (isH) {
    // Strict: segments ON the boundary row/column are clear corridors, not hits
    if (y1 <= top || y1 >= bottom) return false;
    const lo = Math.min(x1, x2);
    const hi = Math.max(x1, x2);
    return hi > left && lo < right;
  }
  if (isV) {
    if (x1 <= left || x1 >= right) return false;
    const lo = Math.min(y1, y2);
    const hi = Math.max(y1, y2);
    return hi > top && lo < bottom;
  }
  return false;
}

/** Check if a point is inside any obstacle's padded zone */
function pointInsideAny(
  x: number,
  y: number,
  obstacles: Rect[],
  pad: number,
): boolean {
  for (const obs of obstacles) {
    if (
      x > obs.x - pad + 1 &&
      x < obs.x + obs.width + pad - 1 &&
      y > obs.y - pad + 1 &&
      y < obs.y + obs.height + pad - 1
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Find an orthogonal route from source (right handle) to target (left handle)
 * that avoids all obstacles.
 *
 * Returns array of waypoints including source and target handle positions.
 */
export type RouteSide = "left" | "right" | "top" | "bottom";

/** Step `pad` away from a point in the direction a handle side faces. */
function stepOut(x: number, y: number, side: RouteSide, pad: number): Point {
  switch (side) {
    case "left":
      return { x: x - pad, y };
    case "right":
      return { x: x + pad, y };
    case "top":
      return { x, y: y - pad };
    case "bottom":
      return { x, y: y + pad };
  }
}

export function findOrthogonalRoute(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  obstacles: Rect[],
  pad: number = 12,
  sourceSide?: RouteSide,
  targetSide?: RouteSide,
): Point[] {
  // Exit/entry direction. When the handle sides are known (they always are
  // for a real edge — React Flow passes the handle's Position) the line leaves
  // the source PERPENDICULAR to the side it is attached to and enters the
  // target the same way, like Lucid/draw.io: a line drawn from a top port goes
  // up first instead of sliding along the shape. Without sides, fall back to
  // the relative-position heuristic (exit right when the target is to the
  // right, else left — avoids a U-turn through the global highway).
  const goRight = targetX >= sourceX;
  const exit = stepOut(
    sourceX,
    sourceY,
    sourceSide ?? (goRight ? "right" : "left"),
    pad,
  );
  const entry = stepOut(
    targetX,
    targetY,
    targetSide ?? (goRight ? "left" : "right"),
    pad,
  );
  const exitX = exit.x;
  const entryX = entry.x;

  // Build sparse grid from obstacle boundaries + padding
  const xSet = new Set<number>();
  const ySet = new Set<number>();

  // Source/target coordinates
  xSet.add(exitX);
  xSet.add(entryX);
  ySet.add(exit.y);
  ySet.add(entry.y);

  // Obstacle edge coordinates (create routing channels around each obstacle)
  for (const obs of obstacles) {
    xSet.add(obs.x - pad);
    xSet.add(obs.x + obs.width + pad);
    ySet.add(obs.y - pad);
    ySet.add(obs.y + obs.height + pad);
  }

  // Add global highways above and below all obstacles (guaranteed free)
  let globalTop = exit.y;
  let globalBottom = exit.y;
  for (const obs of obstacles) {
    globalTop = Math.min(globalTop, obs.y);
    globalBottom = Math.max(globalBottom, obs.y + obs.height);
  }
  // Global highways as guaranteed fallback (pad*4 = 48px clearance)
  globalTop = Math.min(globalTop, entry.y) - pad * 4;
  globalBottom = Math.max(globalBottom, entry.y) + pad * 4;
  ySet.add(globalTop);
  ySet.add(globalBottom);

  // Add global left/right highways for backwards routing
  let globalLeft = Math.min(exitX, entryX);
  let globalRight = Math.max(exitX, entryX);
  for (const obs of obstacles) {
    globalLeft = Math.min(globalLeft, obs.x);
    globalRight = Math.max(globalRight, obs.x + obs.width);
  }
  globalLeft -= pad * 4;
  globalRight += pad * 4;
  xSet.add(globalLeft);
  xSet.add(globalRight);

  const xs = Array.from(xSet).sort((a, b) => a - b);
  const ys = Array.from(ySet).sort((a, b) => a - b);

  const cols = xs.length;
  const rows = ys.length;

  // Find grid indices for start and end
  const si = xs.indexOf(exitX);
  const sj = ys.indexOf(exit.y);
  const ei = xs.indexOf(entryX);
  const ej = ys.indexOf(entry.y);

  if (si < 0 || sj < 0 || ei < 0 || ej < 0) {
    // Fallback: direct path
    return [
      { x: sourceX, y: sourceY },
      { x: targetX, y: targetY },
    ];
  }

  // A* search on the sparse grid
  const key = (i: number, j: number) => j * cols + i;
  const startKey = key(si, sj);
  const endKey = key(ei, ej);

  const gScore = new Map<number, number>();
  const fScore = new Map<number, number>();
  const parent = new Map<number, number>();
  const closed = new Set<number>();

  // Priority queue (simple array-based for small grids)
  const open: number[] = [startKey];
  gScore.set(startKey, 0);
  fScore.set(startKey, Math.abs(xs[ei] - xs[si]) + Math.abs(ys[ej] - ys[sj]));

  // Direction from parent (for turn penalty)
  const dirFromParent = new Map<number, "h" | "v" | null>();
  dirFromParent.set(startKey, null);

  while (open.length > 0) {
    // Find lowest f in open set
    let bestIdx = 0;
    let bestF = fScore.get(open[0]) ?? Infinity;
    for (let k = 1; k < open.length; k++) {
      const f = fScore.get(open[k]) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        bestIdx = k;
      }
    }

    const currentKey = open[bestIdx];
    open.splice(bestIdx, 1);

    if (currentKey === endKey) break; // Found!
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);

    const ci = currentKey % cols;
    const cj = Math.floor(currentKey / cols);
    const cg = gScore.get(currentKey) ?? Infinity;
    const currentDir = dirFromParent.get(currentKey) ?? null;

    // Explore all neighbors (adjacent grid cells in 4 directions)
    const neighbors: [number, number, "h" | "v"][] = [];
    if (ci > 0) neighbors.push([ci - 1, cj, "h"]);
    if (ci < cols - 1) neighbors.push([ci + 1, cj, "h"]);
    if (cj > 0) neighbors.push([ci, cj - 1, "v"]);
    if (cj < rows - 1) neighbors.push([ci, cj + 1, "v"]);

    for (const [ni, nj, dir] of neighbors) {
      const nk = key(ni, nj);
      if (closed.has(nk)) continue;

      // Check if the target grid point is inside an obstacle
      if (pointInsideAny(xs[ni], ys[nj], obstacles, pad * 0.5)) continue;

      // Check if the segment between current and neighbor crosses an obstacle
      const blocked = obstacles.some((obs) =>
        segmentHitsRect(xs[ci], ys[cj], xs[ni], ys[nj], obs, pad),
      );
      if (blocked) continue;

      // Cost: distance + small turn penalty to prefer fewer jogs
      const dist = Math.abs(xs[ci] - xs[ni]) + Math.abs(ys[cj] - ys[nj]);
      const turnPenalty = currentDir !== null && dir !== currentDir ? 20 : 0;
      const ng = cg + dist + turnPenalty;

      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        fScore.set(
          nk,
          ng + Math.abs(xs[ei] - xs[ni]) + Math.abs(ys[ej] - ys[nj]),
        );
        parent.set(nk, currentKey);
        dirFromParent.set(nk, dir);
        open.push(nk);
      }
    }
  }

  // Reconstruct path
  const gridPath: Point[] = [];
  let current: number | undefined = endKey;
  while (current !== undefined && current !== startKey) {
    const pi = current % cols;
    const pj = Math.floor(current / cols);
    gridPath.unshift({ x: xs[pi], y: ys[pj] });
    current = parent.get(current);
  }
  gridPath.unshift({ x: xs[si], y: ys[sj] });

  // If A* failed (no path found), use safe fallback
  if (!parent.has(endKey) && startKey !== endKey) {
    return [
      { x: sourceX, y: sourceY },
      exit,
      { x: exitX, y: globalTop },
      { x: entryX, y: globalTop },
      entry,
      { x: targetX, y: targetY },
    ];
  }

  // Simplify path: remove collinear points (same X or same Y as both neighbors)
  const simplified: Point[] = [gridPath[0]];
  for (let i = 1; i < gridPath.length - 1; i++) {
    const prev = gridPath[i - 1];
    const curr = gridPath[i];
    const next = gridPath[i + 1];
    const collinearH =
      Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5;
    const collinearV =
      Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5;
    if (!collinearH && !collinearV) {
      simplified.push(curr); // Direction change — keep this corner
    }
  }
  simplified.push(gridPath[gridPath.length - 1]);

  // Build full waypoint list: sourceHandle → exit → route → entry → targetHandle
  return [
    { x: sourceX, y: sourceY },
    ...simplified,
    { x: targetX, y: targetY },
  ];
}

const AXIS_EPS = 0.01;

/**
 * Force a waypoint run to strict 90° by inserting an elbow wherever two
 * consecutive points differ on BOTH axes.
 *
 * Manually dragged waypoints are drawn as a direct polyline, so a point placed
 * before the orthogonal lock (or dragged freely) renders as a diagonal — the
 * "edges go in angles" report, reproduced from real saved data:
 *   (280,-112) → (352,-64) → (449,-112)
 * The user's point is still passed through; only the approach to it is squared,
 * so their routing intent survives while the geometry stays orthogonal.
 *
 * The elbow continues the previous segment's axis where there is one (a run
 * that arrived horizontally leaves horizontally first), which avoids inserting
 * a zigzag against the direction the line was already travelling.
 */
export function orthogonalizeWaypoints(pts: Point[]): Point[] {
  // Defensive: a sparse array (a hole from an out-of-range index write) yields
  // `undefined` entries that would throw on `.x`. Geometry helpers should not
  // be the place a UI indexing bug surfaces as a crash.
  pts = pts.filter(
    (p): p is Point => !!p && Number.isFinite(p.x) && Number.isFinite(p.y),
  );
  if (pts.length < 2) return pts;
  const out: Point[] = [pts[0]];
  let prevWasHorizontal: boolean | null = null;

  for (let i = 1; i < pts.length; i++) {
    const a = out[out.length - 1];
    const b = pts[i];
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);

    if (dx <= AXIS_EPS || dy <= AXIS_EPS) {
      // Already axis-aligned (or a zero-length hop).
      if (dx > AXIS_EPS) prevWasHorizontal = true;
      else if (dy > AXIS_EPS) prevWasHorizontal = false;
      out.push(b);
      continue;
    }

    // Diagonal: insert one corner. Leaving along the axis we arrived on keeps
    // the line moving the way it already was.
    const horizontalFirst: boolean = prevWasHorizontal ?? dx >= dy;
    out.push(horizontalFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y });
    out.push(b);
    prevWasHorizontal = !horizontalFirst;
  }
  return out;
}

/** Points within this many px count as aligned when collapsing segments. */
const COLLINEAR_EPS = 2;

/**
 * Collapse redundant points from an orthogonal run.
 *
 * Dragging a segment adds waypoints, but nothing removed them again — so once
 * the user dragged a segment back into line with its neighbours the corner
 * stayed, leaving a run of handles along what is visually one straight
 * segment. Adding was implemented; removing was not.
 *
 * Two kinds of redundancy are removed, repeatedly until stable:
 *   - a point that repeats the previous one (zero-length segment)
 *   - a point whose neighbours share its axis (three collinear points describe
 *     one segment, so the middle one carries no information)
 *
 * Pass the FULL run including the source and target ends: a waypoint that has
 * come into line with the endpoint it hangs off is redundant too, and that case
 * is invisible if only the interior points are considered.
 */
export function simplifyWaypoints(pts: Point[]): Point[] {
  pts = pts.filter(
    (p): p is Point => !!p && Number.isFinite(p.x) && Number.isFinite(p.y),
  );
  if (pts.length < 3) return pts;
  let out = pts.slice();
  let changed = true;

  while (changed && out.length >= 3) {
    changed = false;
    const next: Point[] = [out[0]];

    for (let i = 1; i < out.length - 1; i++) {
      const prev = next[next.length - 1];
      const cur = out[i];
      const after = out[i + 1];

      const duplicate =
        Math.abs(cur.x - prev.x) <= COLLINEAR_EPS &&
        Math.abs(cur.y - prev.y) <= COLLINEAR_EPS;
      const collinear =
        (Math.abs(prev.x - cur.x) <= COLLINEAR_EPS &&
          Math.abs(cur.x - after.x) <= COLLINEAR_EPS) ||
        (Math.abs(prev.y - cur.y) <= COLLINEAR_EPS &&
          Math.abs(cur.y - after.y) <= COLLINEAR_EPS);

      if (duplicate || collinear) {
        changed = true;
        continue; // drop `cur`
      }
      next.push(cur);
    }

    const last = out[out.length - 1];
    const prev = next[next.length - 1];
    if (
      Math.abs(last.x - prev.x) > COLLINEAR_EPS ||
      Math.abs(last.y - prev.y) > COLLINEAR_EPS
    ) {
      next.push(last);
    } else {
      next[next.length - 1] = last; // endpoint wins over a coincident waypoint
      changed = true;
    }
    out = next;
  }
  return out;
}

/** Convert waypoints to SVG path string + label position */
export function waypointsToSvg(pts: Point[]): [string, number, number] {
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const mid = Math.floor(pts.length / 2);
  return [d, pts[mid].x, pts[mid].y];
}
