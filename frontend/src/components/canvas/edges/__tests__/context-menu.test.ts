/**
 * Tests for edge context-menu actions.
 *
 * The UI-level menu is tested via the canvas-store actions it calls.
 * The reverseEdge action is the key new behavior.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useCanvasStore, type CanvasEdge } from "@/stores/canvas";

function makeEdge(
  id: string,
  source: string,
  target: string,
  overrides: Partial<CanvasEdge> = {},
): CanvasEdge {
  return {
    id,
    source,
    target,
    type: "security",
    sourceHandle: `${source}-src-source`,
    targetHandle: `${target}-tgt-target`,
    data: { encrypted: false, authenticated: false },
    ...overrides,
  } as CanvasEdge;
}

beforeEach(() => {
  useCanvasStore.setState({
    edges: [makeEdge("e1", "a", "b"), makeEdge("e2", "c", "d")],
    nodes: [],
    selectedNodeIds: [],
    selectedEdgeIds: [],
    isDirty: false,
  });
});

describe("reverseEdge", () => {
  it("swaps source and target", () => {
    useCanvasStore.getState().reverseEdge("e1");
    const edge = useCanvasStore.getState().edges.find((e) => e.id === "e1")!;
    expect(edge.source).toBe("b");
    expect(edge.target).toBe("a");
  });

  it("swaps source and target handles", () => {
    useCanvasStore.getState().reverseEdge("e1");
    const edge = useCanvasStore.getState().edges.find((e) => e.id === "e1")!;
    expect(edge.sourceHandle).toBe("b-tgt-target");
    expect(edge.targetHandle).toBe("a-src-source");
  });

  it("does not affect other edges", () => {
    useCanvasStore.getState().reverseEdge("e1");
    const e2 = useCanvasStore.getState().edges.find((e) => e.id === "e2")!;
    expect(e2.source).toBe("c");
    expect(e2.target).toBe("d");
  });

  it("marks canvas dirty", () => {
    useCanvasStore.setState({ isDirty: false });
    useCanvasStore.getState().reverseEdge("e1");
    expect(useCanvasStore.getState().isDirty).toBe(true);
  });

  it("noop on unknown edge ID", () => {
    const before = useCanvasStore.getState().edges.map((e) => e.source);
    useCanvasStore.getState().reverseEdge("nonexistent");
    const after = useCanvasStore.getState().edges.map((e) => e.source);
    expect(after).toEqual(before);
  });
});

describe("reset line via updateEdgeData", () => {
  it("clears waypoints to null (auto-route)", () => {
    useCanvasStore.setState({
      edges: [
        makeEdge("e1", "a", "b", {
          data: {
            waypoints: [{ x: 50, y: 50 }],
            encrypted: false,
            authenticated: false,
          },
        }),
      ],
    });
    useCanvasStore.getState().updateEdgeData("e1", { waypoints: null });
    const edge = useCanvasStore.getState().edges.find((e) => e.id === "e1")!;
    expect(edge.data?.waypoints).toBeNull();
  });
});
