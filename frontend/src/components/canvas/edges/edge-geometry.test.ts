/**
 * SecurityEdge geometry helpers — unit tests
 *
 * ptSegDist and nearestSegIdx are inlined in SecurityEdge.tsx.
 * We duplicate the implementations here so they can be tested
 * without a DOM/React environment.
 */
import { describe, it, expect } from "vitest";

type Pt = { x: number; y: number };

function ptSegDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq),
  );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function nearestSegIdx(pts: Pt[], p: Pt): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = ptSegDist(p, pts[i], pts[i + 1]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

describe("ptSegDist", () => {
  it("returns 0 for point on segment", () => {
    expect(
      ptSegDist({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    ).toBeCloseTo(0);
  });

  it("returns perpendicular distance for point off segment", () => {
    // point (5, 3), segment horizontal along y=0 from (0,0) to (10,0)
    expect(
      ptSegDist({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    ).toBeCloseTo(3);
  });

  it("returns distance to nearest endpoint when projection is outside segment", () => {
    // point at (-5, 0), segment (0,0)→(10,0) — nearest is (0,0) at distance 5
    expect(
      ptSegDist({ x: -5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    ).toBeCloseTo(5);
  });

  it("handles degenerate segment (a === b)", () => {
    expect(
      ptSegDist({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 }),
    ).toBeCloseTo(5);
  });

  it("handles vertical segment", () => {
    expect(
      ptSegDist({ x: 3, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 10 }),
    ).toBeCloseTo(3);
  });

  it("handles diagonal segment", () => {
    // Point (0, 2) vs segment (0,0)→(2,2). Perpendicular foot is (1,1), distance = sqrt(2)
    expect(
      ptSegDist({ x: 0, y: 2 }, { x: 0, y: 0 }, { x: 2, y: 2 }),
    ).toBeCloseTo(Math.SQRT2);
  });
});

describe("nearestSegIdx", () => {
  it("returns 0 for single segment", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(nearestSegIdx(pts, { x: 5, y: 3 })).toBe(0);
  });

  it("finds correct segment in L-shaped path", () => {
    // Path: (0,0) → (10,0) → (10,10)
    // Point (10, 5) is on the vertical segment [1]
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(nearestSegIdx(pts, { x: 10, y: 5 })).toBe(1);
  });

  it("finds segment [0] when point is near first horizontal", () => {
    // Path: (0,0) → (10,0) → (10,10)
    // Point (5, 1) is closest to horizontal segment [0]
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(nearestSegIdx(pts, { x: 5, y: 1 })).toBe(0);
  });

  it("handles three-segment path (Z-route)", () => {
    // (0,0) → (0,50) → (100,50) → (100,0)
    // Point (50, 52) is closest to middle horizontal segment [1]
    const pts = [
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 0 },
    ];
    expect(nearestSegIdx(pts, { x: 50, y: 52 })).toBe(1);
  });

  it("returns last valid index when point is at end", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    expect(nearestSegIdx(pts, { x: 18, y: 0 })).toBe(1);
  });
});
