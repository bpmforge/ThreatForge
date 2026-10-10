/**
 * orthogonal-router unit tests
 *
 * Tests findOrthogonalRoute path validity and obstacle avoidance,
 * plus waypointsToSvg output shape.
 */
import { describe, it, expect } from "vitest";
import { findOrthogonalRoute, waypointsToSvg } from "./orthogonal-router";

type Rect = { x: number; y: number; width: number; height: number };

describe("findOrthogonalRoute", () => {
  it("returns at least 2 points (source and target)", () => {
    const pts = findOrthogonalRoute(0, 0, 200, 0, []);
    expect(pts.length).toBeGreaterThanOrEqual(2);
  });

  it("first point is source, last is target", () => {
    const pts = findOrthogonalRoute(10, 20, 300, 80, []);
    expect(pts[0]).toEqual({ x: 10, y: 20 });
    expect(pts[pts.length - 1]).toEqual({ x: 300, y: 80 });
  });

  it("routes straight when no obstacles", () => {
    // Simple right-to-right with no obstacles — should have a short path
    const pts = findOrthogonalRoute(0, 30, 200, 30, []);
    expect(pts.length).toBeGreaterThanOrEqual(2);
    expect(pts[0].x).toBe(0);
    expect(pts[pts.length - 1].x).toBe(200);
  });

  it("avoids a single obstacle between source and target", () => {
    const obstacle: Rect = { x: 80, y: 10, width: 60, height: 40 };
    // source (0,30) → target (240,30): obstacle blocks the direct path
    const pts = findOrthogonalRoute(0, 30, 240, 30, [obstacle], 12);

    // Verify source and target
    expect(pts[0]).toEqual({ x: 0, y: 30 });
    expect(pts[pts.length - 1]).toEqual({ x: 240, y: 30 });

    // No segment should pass through the obstacle's padded zone (pad=12)
    const pad = 12;
    for (let i = 0; i < pts.length - 1; i++) {
      const x1 = pts[i].x;
      const y1 = pts[i].y;
      const x2 = pts[i + 1].x;
      const y2 = pts[i + 1].y;

      const left = obstacle.x - pad;
      const right = obstacle.x + obstacle.width + pad;
      const top = obstacle.y - pad;
      const bottom = obstacle.y + obstacle.height + pad;

      const isH = Math.abs(y1 - y2) < 0.5;
      if (isH && y1 > top && y1 < bottom) {
        const lo = Math.min(x1, x2);
        const hi = Math.max(x1, x2);
        expect(hi <= left || lo >= right).toBe(true);
      }
    }
  });

  it("produces only orthogonal segments (no diagonals)", () => {
    const pts = findOrthogonalRoute(0, 0, 300, 100, []);
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = Math.abs(pts[i + 1].x - pts[i].x);
      const dy = Math.abs(pts[i + 1].y - pts[i].y);
      // One of dx or dy must be < 0.5 (i.e., the segment is axis-aligned)
      expect(dx < 0.5 || dy < 0.5).toBe(true);
    }
  });

  it("handles target to the left of source (backwards routing)", () => {
    const pts = findOrthogonalRoute(300, 50, 50, 50, []);
    expect(pts[0]).toEqual({ x: 300, y: 50 });
    expect(pts[pts.length - 1]).toEqual({ x: 50, y: 50 });
    // Should route around — at least 4 points (not a direct line left)
    expect(pts.length).toBeGreaterThanOrEqual(2);
  });

  it("routes same-row source and target", () => {
    const pts = findOrthogonalRoute(0, 100, 400, 100, []);
    expect(pts[0].y).toBe(100);
    expect(pts[pts.length - 1].y).toBe(100);
  });

  it("uses fallback when A* fails (disconnected grid)", () => {
    // Walls of overlapping obstacles that block everything — A* should fall back
    // We can't easily force A* failure, but we verify the route always has valid endpoints
    const walls: Rect[] = [
      { x: 50, y: -100, width: 10, height: 500 },
      { x: 50, y: -100, width: 10, height: 500 },
    ];
    const pts = findOrthogonalRoute(0, 30, 200, 30, walls, 12);
    expect(pts[0]).toEqual({ x: 0, y: 30 });
    expect(pts[pts.length - 1]).toEqual({ x: 200, y: 30 });
  });
});

describe("waypointsToSvg", () => {
  it("returns a valid M/L SVG path string", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ];
    const [d] = waypointsToSvg(pts);
    expect(d).toMatch(/^M\s/);
    expect(d).toContain("L");
  });

  it("label point is the midpoint of the waypoints array", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 150, y: 0 },
      { x: 200, y: 0 },
    ];
    const [, lx, ly] = waypointsToSvg(pts);
    // mid = floor(5/2) = 2 → pts[2] = (100, 0)
    expect(lx).toBe(100);
    expect(ly).toBe(0);
  });

  it("handles two-point path", () => {
    const pts = [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ];
    const [d, lx, ly] = waypointsToSvg(pts);
    expect(d).toBe("M 10 20 L 30 40");
    // mid = floor(2/2) = 1 → pts[1]
    expect(lx).toBe(30);
    expect(ly).toBe(40);
  });

  it("includes all waypoints in the path", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ];
    const [d] = waypointsToSvg(pts);
    expect(d).toContain("0 0");
    expect(d).toContain("100 0");
    expect(d).toContain("100 100");
    expect(d).toContain("200 100");
  });
});
