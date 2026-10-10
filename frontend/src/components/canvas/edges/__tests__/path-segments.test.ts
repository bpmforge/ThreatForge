import { describe, it, expect } from "vitest";
import { extractSegments, pointAt, closestT } from "../path-segments";

describe("extractSegments", () => {
  it("returns empty array for empty path", () => {
    expect(extractSegments("")).toHaveLength(0);
    expect(extractSegments("M 0 0")).toHaveLength(0);
  });

  it("straight line (M + L) → 1 segment", () => {
    const segs = extractSegments("M 0 0 L 100 0");
    expect(segs).toHaveLength(1);
    expect(segs[0].start).toEqual({ x: 0, y: 0 });
    expect(segs[0].end).toEqual({ x: 100, y: 0 });
    expect(segs[0].orientation).toBe("horizontal");
    expect(segs[0].midpoint).toEqual({ x: 50, y: 0 });
    expect(segs[0].waypointIndex).toBeNull();
  });

  it("vertical line → orientation=vertical", () => {
    const segs = extractSegments("M 50 0 L 50 200");
    expect(segs[0].orientation).toBe("vertical");
  });

  it("diagonal line → orientation=diagonal", () => {
    const segs = extractSegments("M 0 0 L 100 100");
    expect(segs[0].orientation).toBe("diagonal");
  });

  it("step/smoothstep polyline (3 segments)", () => {
    const segs = extractSegments("M 0 100 L 100 100 L 100 200 L 200 200");
    expect(segs).toHaveLength(3);
    expect(segs[0].orientation).toBe("horizontal");
    expect(segs[1].orientation).toBe("vertical");
    expect(segs[2].orientation).toBe("horizontal");
    // Midpoints
    expect(segs[0].midpoint).toEqual({ x: 50, y: 100 });
    expect(segs[1].midpoint).toEqual({ x: 100, y: 150 });
  });

  it("bezier (C command) → 1 segment, orientation=curve", () => {
    const segs = extractSegments("M 0 0 C 50 0 50 100 100 100");
    expect(segs).toHaveLength(1);
    expect(segs[0].orientation).toBe("curve");
    expect(segs[0].start).toEqual({ x: 0, y: 0 });
    expect(segs[0].end).toEqual({ x: 100, y: 100 });
    // De Casteljau midpoint at t=0.5: (0 + 3*50 + 3*50 + 100)/8 = 400/8 = 50
    expect(segs[0].midpoint.x).toBeCloseTo(50);
    expect(segs[0].midpoint.y).toBeCloseTo(50);
  });

  it("polyline with 2 waypoints assigns waypointIndex correctly", () => {
    const waypoints = [
      { x: 100, y: 0 },
      { x: 100, y: 200 },
    ];
    const segs = extractSegments(
      "M 0 0 L 100 0 L 100 200 L 200 200",
      waypoints,
    );
    expect(segs[0].waypointIndex).toBe(0);
    expect(segs[1].waypointIndex).toBe(1);
    expect(segs[2].waypointIndex).toBeNull();
  });

  it("manual flag is true only for manual:true waypoints", () => {
    const waypoints = [
      { x: 100, y: 0, manual: true },
      { x: 100, y: 200, manual: false },
    ];
    const segs = extractSegments(
      "M 0 0 L 100 0 L 100 200 L 200 200",
      waypoints,
    );
    expect(segs[0].manual).toBe(true);
    expect(segs[1].manual).toBe(false);
    expect(segs[2].manual).toBe(false);
  });

  it("smoothstep path with 2 waypoints → 5 segments", () => {
    const path = "M 0 100 L 50 100 L 50 150 L 150 150 L 150 200 L 200 200";
    const segs = extractSegments(path);
    expect(segs).toHaveLength(5);
  });
});

describe("pointAt", () => {
  it("t=0.5 on straight horizontal line → midpoint", () => {
    const pt = pointAt("M 0 0 L 100 0", 0.5);
    expect(pt.x).toBeCloseTo(50);
    expect(pt.y).toBeCloseTo(0);
  });

  it("t=0 returns start point", () => {
    const pt = pointAt("M 10 20 L 110 20", 0);
    expect(pt.x).toBeCloseTo(10);
    expect(pt.y).toBeCloseTo(20);
  });

  it("t=1 returns end point", () => {
    const pt = pointAt("M 10 20 L 110 20", 1);
    expect(pt.x).toBeCloseTo(110);
    expect(pt.y).toBeCloseTo(20);
  });

  it("t=0.25 on step path positions in first segment", () => {
    // Total length: 100 (h) + 100 (v) = 200. t=0.25 → 50px → halfway along segment 0
    const pt = pointAt("M 0 0 L 100 0 L 100 100", 0.25);
    expect(pt.x).toBeCloseTo(50);
    expect(pt.y).toBeCloseTo(0);
  });
});

describe("closestT", () => {
  it("point at midpoint of straight line → t≈0.5", () => {
    const t = closestT("M 0 0 L 100 0", { x: 50, y: 0 });
    expect(t).toBeCloseTo(0.5);
  });

  it("point at start → t≈0", () => {
    const t = closestT("M 0 0 L 100 0", { x: 0, y: 0 });
    expect(t).toBeCloseTo(0);
  });

  it("point at end → t≈1", () => {
    const t = closestT("M 0 0 L 100 0", { x: 100, y: 0 });
    expect(t).toBeCloseTo(1);
  });

  it("point off the path projects to nearest segment", () => {
    // Cursor at (50, 50) off a horizontal line — projects to midpoint (50,0), t=0.5
    const t = closestT("M 0 0 L 100 0", { x: 50, y: 50 });
    expect(t).toBeCloseTo(0.5);
  });

  it("point between two segments selects closest one", () => {
    // Step path: (0,0)→(100,0)→(100,100). Cursor at (100,50) → halfway on vertical seg
    // Vertical seg starts at 100px in, so t = (100 + 50) / 200 = 0.75
    const t = closestT("M 0 0 L 100 0 L 100 100", { x: 100, y: 50 });
    expect(t).toBeCloseTo(0.75);
  });
});
