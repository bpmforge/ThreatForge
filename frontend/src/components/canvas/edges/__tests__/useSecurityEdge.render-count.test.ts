/**
 * Render-count guard: hovering across nodes must only re-render the edges
 * whose highlight/dim state actually changes. useSecurityEdge used to
 * subscribe to hoveredNodeId itself, re-rendering every edge on every hover
 * change.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { Position } from "@xyflow/react";
import { useCanvasStore } from "@/stores/canvas";
import { useSecurityEdge } from "../useSecurityEdge";

// Routing needs a React Flow provider and is not under test here.
vi.mock("../useEdgePathComputation", () => ({
  useEdgePathComputation: () => ({ corners: [], segments: [] }),
}));
vi.mock("../useEdgeWaypointHandlers", () => ({
  useEdgeWaypointHandlers: () => ({}),
}));

const edgeProps = {
  id: "e1",
  source: "a",
  target: "b",
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 0,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  data: undefined,
};

function hover(id: string | null) {
  act(() => {
    useCanvasStore.setState({ hoveredNodeId: id });
  });
}

beforeEach(() => {
  useCanvasStore.setState({ hoveredNodeId: "x0" });
});

describe("useSecurityEdge hover render count", () => {
  it("does not re-render while hover moves between unrelated nodes", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useSecurityEdge(edgeProps);
    });
    renders = 0;

    for (let i = 1; i <= 10; i++) hover(`x${i}`);

    expect(renders).toBe(0);
    expect(result.current.isDimmed).toBe(true);
    expect(result.current.isHighlighted).toBe(false);
  });

  it("re-renders when its own endpoint is hovered or hover clears", () => {
    const { result } = renderHook(() => useSecurityEdge(edgeProps));

    hover("a");
    expect(result.current.isHighlighted).toBe(true);
    expect(result.current.isDimmed).toBe(false);

    hover(null);
    expect(result.current.isHighlighted).toBe(false);
    expect(result.current.isDimmed).toBe(false);
  });
});
