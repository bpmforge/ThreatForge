/**
 * Orthogonal lock — every RF edge must render strictly horizontal/vertical.
 *
 * `useSecurityEdge` pins `lineStyle` to "smoothstep", which routes through
 * `buildAvoidancePath` → `findOrthogonalRoute` → `waypointsToSvg`. These tests
 * assert the produced geometry directly: parse the SVG path and require every
 * consecutive segment to share an x or a y. A diagonal segment (the bug being
 * prevented — "edges went in angles") fails the axis-aligned check.
 */
import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import { Position } from "@xyflow/react";
import { buildAvoidancePath } from "./security-edge-utils";
import {
  waypointsToSvg,
  orthogonalizeWaypoints,
  simplifyWaypoints,
} from "./orthogonal-router";

type Pt = { x: number; y: number };

/** Parse an "M x y L x y L …" path into points. */
function parsePath(d: string): Pt[] {
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2)
    pts.push({ x: nums[i], y: nums[i + 1] });
  return pts;
}

/** Every consecutive pair must share x (vertical) or y (horizontal). */
function diagonalSegments(pts: Pt[]): Array<[Pt, Pt]> {
  const bad: Array<[Pt, Pt]> = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    // A segment may be zero-length; otherwise exactly one axis may vary.
    if (dx > 0.01 && dy > 0.01) bad.push([a, b]);
  }
  return bad;
}

const node = (id: string, x: number, y: number): Node =>
  ({
    id,
    position: { x, y },
    data: {},
    width: 160,
    height: 60,
    measured: { width: 160, height: 60 },
  }) as unknown as Node;

describe("orthogonal lock (React Flow edges)", () => {
  it("routes a plain edge with no diagonal segments", () => {
    const [d] = buildAvoidancePath(
      100,
      100,
      500,
      300,
      Position.Right,
      Position.Left,
      [node("a", 0, 70), node("b", 500, 270)],
    );
    const pts = parsePath(d);
    expect(pts.length).toBeGreaterThan(1);
    expect(diagonalSegments(pts)).toEqual([]);
  });

  it("stays orthogonal when routing around an obstacle", () => {
    // Obstacle sits directly between source and target.
    const [d] = buildAvoidancePath(
      100,
      200,
      700,
      200,
      Position.Right,
      Position.Left,
      [node("a", 0, 170), node("mid", 350, 150), node("b", 700, 170)],
    );
    expect(diagonalSegments(parsePath(d))).toEqual([]);
  });

  it("stays orthogonal for a pure vertical relationship", () => {
    const [d] = buildAvoidancePath(
      300,
      100,
      300,
      600,
      Position.Right,
      Position.Left,
      [node("a", 220, 70), node("b", 220, 570)],
    );
    expect(diagonalSegments(parsePath(d))).toEqual([]);
  });

  it("keeps manually dragged waypoints axis-aligned", () => {
    // Waypoint path is what a user creates by dragging a corner.
    const [d] = waypointsToSvg([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 80 },
      { x: 240, y: 80 },
    ]);
    expect(diagonalSegments(parsePath(d))).toEqual([]);
  });

  it("detects a diagonal — the check itself is not vacuous", () => {
    const [d] = waypointsToSvg([
      { x: 0, y: 0 },
      { x: 100, y: 100 }, // diagonal: the thing we forbid
    ]);
    expect(diagonalSegments(parsePath(d)).length).toBe(1);
  });
});

describe("orthogonalizeWaypoints (saved free-form waypoints)", () => {
  it("squares off the real diagonal waypoints from a saved model", () => {
    // Verbatim from dev.db, edge 1764891278241-mz9xvvy — the V-shape that was
    // still rendering at an angle after the routing mode was pinned.
    const saved = [
      { x: 280, y: 205 },
      { x: 280, y: -112 },
      { x: 352, y: -64 },
      { x: 449, y: -112 },
      { x: 449, y: 55.4609375 },
    ];
    expect(diagonalSegments(saved).length).toBeGreaterThan(0); // was broken
    const fixed = orthogonalizeWaypoints(saved);
    expect(diagonalSegments(fixed)).toEqual([]);
    const [d] = waypointsToSvg(fixed);
    expect(diagonalSegments(parsePath(d))).toEqual([]);
  });

  it("passes through every original waypoint (routing intent preserved)", () => {
    const saved = [
      { x: 0, y: 0 },
      { x: 100, y: 60 },
      { x: 220, y: 10 },
    ];
    const fixed = orthogonalizeWaypoints(saved);
    for (const p of saved) {
      expect(fixed.some((q) => q.x === p.x && q.y === p.y)).toBe(true);
    }
  });

  it("leaves an already-orthogonal run untouched", () => {
    const ortho = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 80 },
    ];
    expect(orthogonalizeWaypoints(ortho)).toEqual(ortho);
  });

  it("handles degenerate input", () => {
    expect(orthogonalizeWaypoints([])).toEqual([]);
    expect(orthogonalizeWaypoints([{ x: 5, y: 5 }])).toEqual([{ x: 5, y: 5 }]);
  });
});

describe("simplifyWaypoints (segments are removed, not just added)", () => {
  it("drops a corner once the user drags it back into line", () => {
    // A drag created a corner; then the segment was aligned with its
    // neighbours, so the corner describes nothing and must go.
    const run = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 }, // collinear with both neighbours
      { x: 200, y: 90 },
    ];
    expect(simplifyWaypoints(run)).toEqual([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 90 },
    ]);
  });

  it("collapses a whole aligned run back to a single straight segment", () => {
    const run = [
      { x: 0, y: 50 },
      { x: 60, y: 50 },
      { x: 120, y: 50 },
      { x: 180, y: 50 },
      { x: 240, y: 50 },
    ];
    expect(simplifyWaypoints(run)).toEqual([
      { x: 0, y: 50 },
      { x: 240, y: 50 },
    ]);
  });

  it("removes duplicate points (zero-length segments)", () => {
    const run = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 80 },
    ];
    expect(simplifyWaypoints(run)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 80 },
    ]);
  });

  it("treats near-alignment (sub-pixel) as aligned", () => {
    const run = [
      { x: 0, y: 0 },
      { x: 100, y: 0.4 },
      { x: 200, y: 0 },
    ];
    expect(simplifyWaypoints(run)).toEqual([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ]);
  });

  it("KEEPS corners that carry real shape", () => {
    const run = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 80 },
      { x: 220, y: 80 },
    ];
    expect(simplifyWaypoints(run)).toEqual(run);
  });

  it("stays orthogonal after simplification", () => {
    const run = orthogonalizeWaypoints([
      { x: 0, y: 0 },
      { x: 100, y: 60 },
      { x: 100, y: 61 },
      { x: 240, y: 61 },
    ]);
    const simplified = simplifyWaypoints(run);
    expect(diagonalSegments(simplified)).toEqual([]);
    const [d] = waypointsToSvg(simplified);
    expect(diagonalSegments(parsePath(d))).toEqual([]);
  });
});

describe("malformed input must not crash the canvas", () => {
  it("survives a sparse array (the hole a bad index write leaves)", () => {
    // usePillDragHandlers does `live[wpIdx] = pos`; an out-of-range wpIdx
    // creates holes. Reaching the router, `undefined.x` took down the edge and
    // — because the throw skipped setDraggingCorners(null) — left the line
    // stuck following the mouse after release.
    const sparse: Array<{ x: number; y: number }> = [];
    sparse[0] = { x: 0, y: 0 };
    sparse[3] = { x: 100, y: 0 }; // indices 1,2 are holes
    expect(() => orthogonalizeWaypoints(sparse)).not.toThrow();
    expect(() => simplifyWaypoints(sparse)).not.toThrow();
    expect(diagonalSegments(orthogonalizeWaypoints(sparse))).toEqual([]);
  });

  it("survives undefined / NaN entries", () => {
    const bad = [
      { x: 0, y: 0 },
      undefined as unknown as { x: number; y: number },
      { x: Number.NaN, y: 10 },
      { x: 100, y: 0 },
    ];
    expect(() => orthogonalizeWaypoints(bad)).not.toThrow();
    expect(() => simplifyWaypoints(bad)).not.toThrow();
    const out = orthogonalizeWaypoints(bad);
    expect(out.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(
      true,
    );
  });
});

describe("live collapse while dragging (drawn path vs drag model)", () => {
  /** The exact composition useEdgePathComputation draws with. */
  const drawn = (source: Pt, wpts: Pt[], target: Pt) =>
    parsePath(
      waypointsToSvg(
        simplifyWaypoints(orthogonalizeWaypoints([source, ...wpts, target])),
      )[0],
    );

  it("straightens as soon as a dragged point comes into line", () => {
    const source = { x: 0, y: 0 };
    const target = { x: 300, y: 0 };
    // Mid-drag the raw list still holds the point being moved...
    const midDrag = [{ x: 150, y: 0 }]; // just dragged into line with both ends
    const path = drawn(source, midDrag, target);
    // ...but the DRAWN path is already a single straight segment.
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ]);
  });

  it("keeps the corner while it still carries shape", () => {
    const path = drawn({ x: 0, y: 0 }, [{ x: 150, y: 90 }], { x: 300, y: 90 });
    expect(path.length).toBeGreaterThan(2); // still bent
    expect(diagonalSegments(path)).toEqual([]);
  });

  it("collapses only the redundant corner in a multi-corner run", () => {
    const path = drawn(
      { x: 0, y: 0 },
      [
        { x: 100, y: 0 }, // real corner: turns from horizontal to vertical
        { x: 100, y: 40 }, // REDUNDANT: sits mid-way along the vertical run
        { x: 100, y: 80 },
        { x: 260, y: 80 },
      ],
      { x: 260, y: 160 },
    );
    expect(diagonalSegments(path)).toEqual([]);
    // Every genuine bend survives; only the mid-run point is dropped.
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 80 },
      { x: 260, y: 80 },
      { x: 260, y: 160 },
    ]);
  });
});
