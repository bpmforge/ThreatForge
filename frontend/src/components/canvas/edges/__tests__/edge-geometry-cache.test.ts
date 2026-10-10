import { describe, it, expect } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import {
  getEdgeGeometryIndex,
  getCachedObstacles,
} from "../edge-geometry-cache";
import { cullObstacles } from "../security-edge-utils";

const node = (id: string, x: number, y: number): Node =>
  ({
    id,
    type: "component",
    position: { x, y },
    measured: { width: 160, height: 60 },
    data: {},
  }) as Node;
const edge = (id: string, s: string, t: string): Edge =>
  ({
    id,
    source: s,
    target: t,
    data: { style: { lineStyle: "smoothstep" } },
  }) as Edge;

describe("edge geometry index", () => {
  const nodes = [node("a", 0, 0), node("b", 400, 0), node("c", 200, 200)];
  const edges = [edge("e1", "a", "b"), edge("e2", "a", "c")];

  it("is computed once per (nodes, edges) identity and shared", () => {
    const first = getEdgeGeometryIndex(nodes, edges);
    expect(getEdgeGeometryIndex(nodes, edges)).toBe(first);
    expect(first.get("e1")?.path).toMatch(/^M /);
    expect(first.get("e1")?.segments.length).toBeGreaterThan(0);
    // A new array identity (what React Flow hands out after a change) → fresh index.
    expect(getEdgeGeometryIndex([...nodes], edges)).not.toBe(first);
    expect(getEdgeGeometryIndex(nodes, [...edges])).not.toBe(first);
  });

  it("caches obstacles per nodes identity", () => {
    expect(getCachedObstacles(nodes)).toBe(getCachedObstacles(nodes));
    expect(getCachedObstacles(nodes)).toHaveLength(3);
  });

  it("ignores malformed waypoints on other edges instead of throwing", () => {
    const bad = {
      ...edge("e3", "a", "b"),
      data: {
        style: { lineStyle: "smoothstep" },
        waypoints: [{ x: NaN, y: 5 }, null],
      },
    } as unknown as Edge;
    expect(() => getEdgeGeometryIndex([...nodes], [bad])).not.toThrow();
  });
});

describe("cullObstacles", () => {
  it("keeps only obstacles near the endpoints' bounding box", () => {
    const obstacles = [
      { x: 100, y: 100, width: 160, height: 60 }, // near
      { x: 5000, y: 5000, width: 160, height: 60 }, // far
    ];
    const kept = cullObstacles(obstacles, 0, 0, 400, 300);
    expect(kept).toHaveLength(1);
    expect(kept[0].x).toBe(100);
  });
});
