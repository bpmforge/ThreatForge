/**
 * Containment rules exercised the way the canvas drives them: absolute
 * frames, nested boundaries, innermost-wins, and boundary growth on drop.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCanvasStore, type CanvasNode } from "@/stores/canvas";
import {
  useBoundaryGrouping,
  resolveContainingBoundary,
} from "./useBoundaryGrouping";
import {
  BOUNDARY_HEADER_HEIGHT,
  BOUNDARY_INNER_PAD,
  MIN_BOUNDARY_HEIGHT,
  MIN_BOUNDARY_WIDTH,
  fitBoundaryToChildren,
  minBoundarySize,
} from "@/stores/canvas/geometry";

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
    zIndex: -1000,
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

function setNodes(nodes: CanvasNode[]) {
  useCanvasStore.setState({
    nodes,
    edges: [],
    selectedNodeIds: [],
    selectedEdgeIds: [],
    isDirty: false,
  });
}

describe("resolveContainingBoundary", () => {
  const outer = boundary("outer", 100, 100, 800, 600);
  const inner = boundary("inner", 50, 80, 300, 200, "outer"); // abs 150,180

  it("picks the innermost boundary under the node centre (absolute frame)", () => {
    const n = component("n", 0, 0);
    const nodes = [outer, inner, n];
    // centre at (260, 250) → inside inner (150..450 × 180..380)
    expect(resolveContainingBoundary(n, { x: 200, y: 218 }, nodes)).toBe(
      "inner",
    );
    // centre at (700, 500) → inside outer only
    expect(resolveContainingBoundary(n, { x: 640, y: 468 }, nodes)).toBe(
      "outer",
    );
    expect(resolveContainingBoundary(n, { x: 0, y: 0 }, nodes)).toBeNull();
  });

  it("a boundary can nest inside a larger boundary but never inside itself or a descendant", () => {
    const nodes = [outer, inner];
    expect(resolveContainingBoundary(inner, { x: 150, y: 180 }, nodes)).toBe(
      "outer",
    );
    // outer's centre sits inside inner's rect, but inner is a descendant.
    expect(
      resolveContainingBoundary(outer, { x: -200, y: -100 }, nodes),
    ).toBeNull();
  });

  it("never drops a node into a boundary smaller than the node", () => {
    const tiny = boundary("tiny", 0, 0, 100, 50);
    const n = component("n", 0, 0);
    expect(resolveContainingBoundary(n, { x: 0, y: 0 }, [tiny, n])).toBeNull();
  });
});

describe("boundary fit (10px clearance on every side)", () => {
  it("minBoundarySize covers the far edges with clearance, never below the minimum", () => {
    expect(minBoundarySize([component("a", 10, 50)])).toEqual({
      width: MIN_BOUNDARY_WIDTH,
      height: MIN_BOUNDARY_HEIGHT,
    });
    expect(minBoundarySize([component("a", 500, 400)])).toEqual({
      width: 500 + 120 + BOUNDARY_INNER_PAD,
      height: 400 + 64 + BOUNDARY_INNER_PAD,
    });
  });

  it("a child hugging the left/top pushes the boundary origin out and keeps the child in place", () => {
    const b = boundary("b", 200, 200, 400, 300);
    const c = component("c", -30, 0, "b"); // absolute (170, 200)
    const out = fitBoundaryToChildren([b, c], "b");
    const nb = out.find((n) => n.id === "b")!;
    const nc = out.find((n) => n.id === "c")!;
    // shiftX = 10 - (-30) = 40, shiftY = 40 + 10 - 0 = 50
    expect(nb.position).toEqual({ x: 160, y: 150 });
    expect(nb.style).toEqual({ width: 440, height: 350 });
    expect(nc.position).toEqual({
      x: BOUNDARY_INNER_PAD,
      y: BOUNDARY_HEADER_HEIGHT + BOUNDARY_INNER_PAD,
    });
    // absolute position unchanged
    expect(nb.position.x + nc.position.x).toBe(170);
    expect(nb.position.y + nc.position.y).toBe(200);
  });

  it("returns the same array when everything already fits", () => {
    const nodes = [boundary("b", 0, 0, 400, 300), component("c", 50, 60, "b")];
    expect(fitBoundaryToChildren(nodes, "b")).toBe(nodes);
  });

  it("cascades to the enclosing boundary when a nested zone grows", () => {
    const outer = boundary("outer", 0, 0, 400, 300);
    const inner = boundary("inner", 50, 60, 200, 150, "outer");
    const c = component("c", 150, 100, "inner"); // right edge 270 > 200
    const out = fitBoundaryToChildren([outer, inner, c], "inner");
    const ni = out.find((n) => n.id === "inner")!;
    const no = out.find((n) => n.id === "outer")!;
    expect(ni.style?.width).toBe(150 + 120 + BOUNDARY_INNER_PAD); // 280
    // inner now spans 50..330 inside outer → outer must be >= 340 wide (fits 400)
    expect(no.style?.width).toBe(400);
    // inner bottom: 60 + (100+64+10=174 → max(150,174)) = 234 < 300 → fine
    expect(no.style?.height).toBe(300);
  });
});

describe("useBoundaryGrouping.processNodeChanges", () => {
  beforeEach(() => {
    setNodes([boundary("b", 200, 200, 400, 300), component("n", 0, 0)]);
  });

  function drag(id: string, to: { x: number; y: number }) {
    const { result } = renderHook(() => useBoundaryGrouping());
    act(() => {
      result.current.processNodeChanges([
        { type: "position", id, position: to, dragging: true },
      ]);
      useCanvasStore
        .getState()
        .onNodesChange([
          { type: "position", id, position: to, dragging: true },
        ]);
      result.current.processNodeChanges([
        { type: "position", id, position: to, dragging: false },
      ]);
    });
  }

  it("reparents a node dropped inside a boundary and GROWS the boundary to fit", () => {
    // Drop near the boundary's bottom-right so the default 400×300 is too small.
    drag("n", { x: 520, y: 420 });
    const s = useCanvasStore.getState();
    const n = s.nodes.find((x) => x.id === "n")!;
    const b = s.nodes.find((x) => x.id === "b")!;
    expect(n.parentId).toBe("b");
    expect(n.position).toEqual({ x: 320, y: 220 }); // relative
    expect(n.extent).toBeUndefined();
    // Before the fix a stale closure saw no children and SHRANK it to 200×150.
    expect(b.style?.width).toBe(320 + 120 + BOUNDARY_INNER_PAD);
    expect(b.style?.height).toBe(300); // 220 + 64 + 10 = 294 < current 300
    // Parent precedes child in the array (React Flow requirement).
    expect(s.nodes.map((x) => x.id)).toEqual(["b", "n"]);
  });

  it("clears the parent when a child is dragged out", () => {
    drag("n", { x: 300, y: 300 });
    expect(
      useCanvasStore.getState().nodes.find((x) => x.id === "n")?.parentId,
    ).toBe("b");
    // child frame: (-400, -400) relative → absolute (-200, -200), outside.
    drag("n", { x: -400, y: -400 });
    const n = useCanvasStore.getState().nodes.find((x) => x.id === "n")!;
    expect(n.parentId).toBeUndefined();
    expect(n.position).toEqual({ x: -200, y: -200 });
  });

  it("does not shrink a boundary the user sized by hand", () => {
    useCanvasStore.getState().updateBoundarySize("b", 900, 700);
    drag("n", { x: 300, y: 300 });
    const b = useCanvasStore.getState().nodes.find((x) => x.id === "b")!;
    expect(b.style?.width).toBe(900);
    expect(b.style?.height).toBe(700);
  });
});
