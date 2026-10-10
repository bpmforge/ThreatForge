/**
 * Render-count guard: a boundary must re-render only when something it
 * derives from its children changes, not on every drag frame of any node.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Profiler } from "react";
import { act, render } from "@testing-library/react";
import type { NodeProps, Node } from "@xyflow/react";
import { useCanvasStore } from "@/stores/canvas";
import type { BoundaryNodeData } from "@/types/canvas";
import { BoundaryNode } from "./BoundaryNode";

const resizerProps: Array<{ minWidth?: number; minHeight?: number }> = [];

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    NodeResizer: (p: { minWidth?: number; minHeight?: number }) => {
      resizerProps.push(p);
      return null;
    },
  };
});

const FRAMES = 10;

function makeNodes(moving: string, dx: number) {
  const component = (id: string, x: number, parentId?: string) => ({
    id,
    type: "component" as const,
    position: { x: id === moving ? x + dx : x, y: 40 },
    width: 160,
    height: 60,
    ...(parentId ? { parentId } : {}),
    data: { label: id, type: "API", trustLevel: "INTERNAL" as const },
  });
  return [
    {
      id: "z",
      type: "boundary" as const,
      position: { x: 0, y: 0 },
      data: { label: "Zone", trustLevel: "DMZ" as const },
    },
    component("c1", 20, "z"),
    component("c2", 200, "z"),
    ...Array.from({ length: 20 }, (_, i) => component(`o${i}`, 1000 + i * 200)),
  ];
}

function dragFrames(id: string) {
  for (let f = 0; f < FRAMES; f++) {
    act(() => {
      useCanvasStore.setState({ nodes: makeNodes(id, (f + 1) * 10) as never });
    });
  }
}

const props = {
  id: "z",
  data: { label: "Zone", trustLevel: "DMZ" },
  selected: true,
  type: "boundary",
  dragging: false,
  zIndex: 0,
  isConnectable: false,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
} as unknown as NodeProps<Node<BoundaryNodeData, "boundary">>;

function renderCounted() {
  const counter = { commits: 0 };
  render(
    <Profiler id="boundary" onRender={() => counter.commits++}>
      <BoundaryNode {...props} />
    </Profiler>,
  );
  counter.commits = 0;
  return counter;
}

beforeEach(() => {
  resizerProps.length = 0;
  useCanvasStore.setState({
    nodes: makeNodes("", 0) as never,
    edges: [],
    selectedNodeIds: [],
    selectedEdgeIds: [],
  });
});

describe("BoundaryNode render count during a drag", () => {
  it("does not re-render while a node outside it moves", () => {
    const counter = renderCounted();
    dragFrames("o3");
    expect(counter.commits).toBe(0);
  });

  it("re-renders with a larger min size while a child moves", () => {
    const counter = renderCounted();
    const before = resizerProps[resizerProps.length - 1].minWidth ?? 0;

    dragFrames("c2");

    expect(counter.commits).toBe(FRAMES);
    const after = resizerProps[resizerProps.length - 1].minWidth ?? 0;
    expect(after).toBe(before + FRAMES * 10);
  });
});
