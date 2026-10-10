/**
 * path-segments — SVG path parser for canvas edge handles.
 *
 * Parses M/L/C commands into Segment descriptors with orientation and
 * midpoint, which drive the Lucid-style pill handles in WaypointHandles.
 */

type Pt = { x: number; y: number };

export type SegmentOrientation =
  | "horizontal"
  | "vertical"
  | "diagonal"
  | "curve";

export interface Segment {
  start: Pt;
  end: Pt;
  orientation: SegmentOrientation;
  midpoint: Pt;
  /**
   * Index into the waypoints array of the waypoint at the END of this
   * segment. Null for auto-routed segments whose end is not a waypoint.
   */
  waypointIndex: number | null;
  /**
   * True when the waypoint at the END of this segment was explicitly placed
   * by the user (manual: true on the waypoint). Drives filled vs hollow pill.
   */
  manual: boolean;
}

function orientation(start: Pt, end: Pt): SegmentOrientation {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  if (dx < 2) return "vertical";
  if (dy < 2) return "horizontal";
  return "diagonal";
}

function lineMidpoint(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// De Casteljau midpoint at t=0.5 for cubic bezier P0..P3
function bezierMidpoint(p0: Pt, p1: Pt, p2: Pt, p3: Pt): Pt {
  return {
    x: (p0.x + 3 * p1.x + 3 * p2.x + p3.x) / 8,
    y: (p0.y + 3 * p1.y + 3 * p2.y + p3.y) / 8,
  };
}

/**
 * Parse an SVG path string (M/L/C commands only — what React Flow emits)
 * into Segment descriptors.
 *
 * @param svgPath - SVG path `d` attribute string
 * @param waypoints - optional waypoint list; used to populate waypointIndex
 */
export function extractSegments(
  svgPath: string,
  waypoints?: Array<Pt & { manual?: boolean }> | null,
): Segment[] {
  const segments: Segment[] = [];
  const tokens = svgPath.match(/[MLCZ][^MLCZ]*/gi);
  if (!tokens) return segments;

  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;

  const waypointSet = new Map<string, number>();
  if (waypoints) {
    waypoints.forEach((wp, i) => {
      waypointSet.set(`${Math.round(wp.x)},${Math.round(wp.y)}`, i);
    });
  }

  for (const token of tokens) {
    const cmd = token[0].toUpperCase();
    const nums = token
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);

    if (cmd === "M") {
      cx = nums[0];
      cy = nums[1];
      startX = cx;
      startY = cy;
    } else if (cmd === "L") {
      const start: Pt = { x: cx, y: cy };
      const end: Pt = { x: nums[0], y: nums[1] };
      const endKey = `${Math.round(end.x)},${Math.round(end.y)}`;
      const wpIdx = waypointSet.get(endKey) ?? null;
      segments.push({
        start,
        end,
        orientation: orientation(start, end),
        midpoint: lineMidpoint(start, end),
        waypointIndex: wpIdx,
        manual:
          wpIdx !== null && waypoints
            ? waypoints[wpIdx]?.manual === true
            : false,
      });
      cx = nums[0];
      cy = nums[1];
    } else if (cmd === "C") {
      // cubic bezier: cx1 cy1 cx2 cy2 ex ey
      const start: Pt = { x: cx, y: cy };
      const p1: Pt = { x: nums[0], y: nums[1] };
      const p2: Pt = { x: nums[2], y: nums[3] };
      const end: Pt = { x: nums[4], y: nums[5] };
      const endKey = `${Math.round(end.x)},${Math.round(end.y)}`;
      const wpIdxC = waypointSet.get(endKey) ?? null;
      segments.push({
        start,
        end,
        orientation: "curve",
        midpoint: bezierMidpoint(start, p1, p2, end),
        waypointIndex: wpIdxC,
        manual:
          wpIdxC !== null && waypoints
            ? waypoints[wpIdxC]?.manual === true
            : false,
      });
      cx = nums[4];
      cy = nums[5];
    } else if (cmd === "Z") {
      // close path — not used in edge paths, skip
      cx = startX;
      cy = startY;
    }
  }

  return segments;
}

/**
 * Compute where along the path (0..1) a given point lies.
 * Only meaningful for polyline paths (M + L commands). Used by label drag.
 */
export function pointAt(svgPath: string, t: number): Pt {
  const segs = extractSegments(svgPath);
  if (segs.length === 0) return { x: 0, y: 0 };

  // Compute arc lengths
  const lengths = segs.map((s) =>
    Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y),
  );
  const total = lengths.reduce((a, b) => a + b, 0);
  if (total === 0) return segs[0].start;

  let remaining = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (remaining <= lengths[i] || i === segs.length - 1) {
      const localT = lengths[i] > 0 ? remaining / lengths[i] : 0;
      return {
        x: segs[i].start.x + localT * (segs[i].end.x - segs[i].start.x),
        y: segs[i].start.y + localT * (segs[i].end.y - segs[i].start.y),
      };
    }
    remaining -= lengths[i];
  }
  return segs[segs.length - 1].end;
}

/**
 * Find the closest arc-length parameter t (0..1) on the path to a given point.
 * Used to project a dragged label position back onto the path.
 */
export function closestT(svgPath: string, point: Pt): number {
  const segs = extractSegments(svgPath);
  if (segs.length === 0) return 0.5;

  const lengths = segs.map((s) =>
    Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y),
  );
  const total = lengths.reduce((a, b) => a + b, 0);
  if (total === 0) return 0.5;

  let bestT = 0.5;
  let bestDist = Infinity;
  let cumLen = 0;

  for (let i = 0; i < segs.length; i++) {
    const { start, end } = segs[i];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lenSq = dx * dx + dy * dy;
    const localT =
      lenSq === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((point.x - start.x) * dx + (point.y - start.y) * dy) / lenSq,
            ),
          );
    const cx = start.x + localT * dx;
    const cy = start.y + localT * dy;
    const dist = Math.hypot(point.x - cx, point.y - cy);
    if (dist < bestDist) {
      bestDist = dist;
      bestT = total > 0 ? (cumLen + localT * lengths[i]) / total : 0.5;
    }
    cumLen += lengths[i];
  }

  return Math.max(0, Math.min(1, bestT));
}
