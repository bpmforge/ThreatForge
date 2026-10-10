import { describe, it, expect } from "vitest";
import type { CanvasNode } from "./types";
import {
  adoptContainedNodes,
  findInnermostBoundary,
  fitBoundaryToChildren,
  getAbsolutePosition,
  getBoundaryRects,
  getDescendantIds,
  getNodeSize,
  sortParentsFirst,
  toRelativePosition,
} from "./geometry";

const boundary = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  parentId?: string,
): CanvasNode =>
  ({
    id,
    type: "boundary",
    position: { x, y },
    parentId,
    style: { width: w, height: h },
    data: { label: id, trustLevel: "INTERNAL" },
  }) as CanvasNode;

const component = (
  id: string,
  x: number,
  y: number,
  parentId?: string,
): CanvasNode =>
  ({
    id,
    type: "component",
    position: { x, y },
    parentId,
    measured: { width: 120, height: 64 },
    data: { label: id, type: "API", trustLevel: "INTERNAL" },
  }) as CanvasNode;

describe("canvas geometry", () => {
  const outer = boundary("outer", 100, 100, 800, 600);
  const inner = boundary("inner", 50, 80, 300, 200, "outer"); // abs 150,180
  const child = component("child", 20, 30, "inner"); // abs 170,210
  const nodes = [child, inner, outer]; // deliberately child-first

  it("resolves absolute positions through nested parents", () => {
    expect(getAbsolutePosition(inner, nodes)).toEqual({ x: 150, y: 180 });
    expect(getAbsolutePosition(child, nodes)).toEqual({ x: 170, y: 210 });
  });

  it("accepts an in-flight relative position override", () => {
    expect(getAbsolutePosition(child, nodes, { x: 0, y: 0 })).toEqual({
      x: 150,
      y: 180,
    });
  });

  it("converts absolute back into a nested parent's frame", () => {
    expect(toRelativePosition({ x: 170, y: 210 }, "inner", nodes)).toEqual({
      x: 20,
      y: 30,
    });
    expect(toRelativePosition({ x: 5, y: 6 }, null, nodes)).toEqual({
      x: 5,
      y: 6,
    });
  });

  it("boundary rects are absolute even when nested", () => {
    const rects = getBoundaryRects(nodes);
    expect(rects.find((r) => r.id === "inner")).toEqual({
      id: "inner",
      x: 150,
      y: 180,
      width: 300,
      height: 200,
    });
  });

  it("innermost boundary wins when boundaries nest", () => {
    const rects = getBoundaryRects(nodes);
    expect(findInnermostBoundary({ x: 200, y: 250 }, rects)?.id).toBe("inner");
    expect(findInnermostBoundary({ x: 700, y: 500 }, rects)?.id).toBe("outer");
    expect(findInnermostBoundary({ x: 10, y: 10 }, rects)).toBeNull();
  });

  it("excluded boundaries (self / descendants) are never candidates", () => {
    const rects = getBoundaryRects(nodes);
    const exclude = getDescendantIds("outer", nodes);
    expect(exclude).toEqual(new Set(["outer", "inner", "child"]));
    expect(
      findInnermostBoundary({ x: 200, y: 250 }, rects, exclude),
    ).toBeNull();
  });

  it("sortParentsFirst puts every parent before its children, stably", () => {
    const sorted = sortParentsFirst(nodes).map((n) => n.id);
    expect(sorted).toEqual(["outer", "inner", "child"]);
    const a = component("a", 0, 0);
    const b = component("b", 0, 0);
    expect(sortParentsFirst([a, b]).map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("getNodeSize prefers measured, then style, then per-type defaults", () => {
    expect(getNodeSize(child)).toEqual({ width: 120, height: 64 });
    expect(getNodeSize(outer)).toEqual({ width: 800, height: 600 });
    expect(getNodeSize({ type: "boundary" } as unknown as CanvasNode)).toEqual({
      width: 400,
      height: 300,
    });
    expect(getNodeSize({ type: "component" } as unknown as CanvasNode)).toEqual(
      { width: 160, height: 60 },
    );
  });
});

describe("adoptContainedNodes — a moved/resized boundary pulls covered nodes in", () => {
  it("adopts a component whose centre is inside and leaves outsiders alone", () => {
    const b = boundary("b", 100, 100, 400, 300);
    const straddling = component("s", 440, 360); // centre (500, 392) inside
    const outside = component("o", 900, 900);
    const out = adoptContainedNodes([b, straddling, outside], "b");
    const s = out.find((n) => n.id === "s")!;
    const o = out.find((n) => n.id === "o")!;
    expect(s.parentId).toBe("b");
    expect(s.position).toEqual({ x: 340, y: 260 }); // relative, unchanged on screen
    expect(o.parentId).toBeUndefined();
    expect(out[0].id).toBe("b"); // parent first
  });

  it("does not steal a node that sits in a smaller nested boundary", () => {
    const outer = boundary("outer", 0, 0, 800, 600);
    const inner = boundary("inner", 100, 100, 300, 200, "outer");
    const c = component("c", 50, 60, "inner");
    expect(adoptContainedNodes([outer, inner, c], "outer")).toEqual([
      outer,
      inner,
      c,
    ]);
  });

  it("returns the same array when nothing is covered", () => {
    const nodes = [boundary("b", 0, 0, 200, 150), component("o", 900, 900)];
    expect(adoptContainedNodes(nodes, "b")).toBe(nodes);
  });
});

describe("robustness", () => {
  it("fitBoundaryToChildren survives a parent cycle", () => {
    const a = { ...boundary("a", 0, 0, 400, 300), parentId: "b" };
    const b = { ...boundary("b", 10, 10, 300, 200), parentId: "a" };
    const c = component("c", 380, 60, "a"); // forces a to grow → cascade to b → a…
    expect(() => fitBoundaryToChildren([a, b, c], "a")).not.toThrow();
  });

  it("a collapsed boundary only claims its header footprint", () => {
    const b = {
      ...boundary("b", 0, 0, 800, 600),
      data: { label: "b", trustLevel: "INTERNAL", collapsed: true },
    } as CanvasNode;
    expect(getNodeSize(b)).toEqual({ width: 240, height: 40 });
    const rects = getBoundaryRects([b]);
    expect(findInnermostBoundary({ x: 400, y: 300 }, rects)).toBeNull();
  });
});
