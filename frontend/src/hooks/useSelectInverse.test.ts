import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSelectInverse } from "./useSelectInverse";
import { useCanvasStore } from "@/stores/canvas";

function makeNode(id: string) {
  return {
    id,
    type: "component" as const,
    position: { x: 0, y: 0 },
    data: {
      label: id,
      type: "PROCESS" as const,
      trustLevel: "INTERNAL" as const,
    },
  };
}

function makeEdge(id: string) {
  return {
    id,
    source: "a",
    target: "b",
    data: {},
  };
}

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [makeNode("a"), makeNode("b"), makeNode("c")],
    edges: [makeEdge("e1"), makeEdge("e2")],
    selectedNodeIds: [],
    selectedEdgeIds: [],
    isDirty: false,
  });
});

describe("useSelectInverse", () => {
  it("selects all nodes when none are selected", () => {
    const { result } = renderHook(() => useSelectInverse());
    result.current.selectInverse();
    expect(useCanvasStore.getState().selectedNodeIds).toEqual(
      expect.arrayContaining(["a", "b", "c"]),
    );
  });

  it("inverts partial node selection", () => {
    useCanvasStore.setState({ selectedNodeIds: ["a"] });
    const { result } = renderHook(() => useSelectInverse());
    result.current.selectInverse();
    const { selectedNodeIds } = useCanvasStore.getState();
    expect(selectedNodeIds).toContain("b");
    expect(selectedNodeIds).toContain("c");
    expect(selectedNodeIds).not.toContain("a");
  });

  it("inverts edge selection", () => {
    useCanvasStore.setState({ selectedEdgeIds: ["e1"] });
    const { result } = renderHook(() => useSelectInverse());
    result.current.selectInverse();
    const { selectedEdgeIds } = useCanvasStore.getState();
    expect(selectedEdgeIds).toContain("e2");
    expect(selectedEdgeIds).not.toContain("e1");
  });

  it("deselects all when everything is selected", () => {
    useCanvasStore.setState({
      selectedNodeIds: ["a", "b", "c"],
      selectedEdgeIds: ["e1", "e2"],
    });
    const { result } = renderHook(() => useSelectInverse());
    result.current.selectInverse();
    expect(useCanvasStore.getState().selectedNodeIds).toHaveLength(0);
    expect(useCanvasStore.getState().selectedEdgeIds).toHaveLength(0);
  });
});
