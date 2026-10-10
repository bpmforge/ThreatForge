import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSelectSameType } from "./useSelectSameType";
import { useCanvasStore } from "@/stores/canvas";

function makeComponent(id: string, type: string) {
  return {
    id,
    type: "component" as const,
    position: { x: 0, y: 0 },
    data: { label: id, type, trustLevel: "INTERNAL" as const },
  };
}

function makeBoundary(id: string) {
  return {
    id,
    type: "boundary" as const,
    position: { x: 0, y: 0 },
    data: { label: id, trustLevel: "INTERNAL" as const },
  };
}

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [
      makeComponent("db1", "DATABASE"),
      makeComponent("db2", "DATABASE"),
      makeComponent("api1", "API"),
      makeBoundary("b1"),
    ],
    edges: [],
    selectedNodeIds: [],
    selectedEdgeIds: [],
    isDirty: false,
  });
});

describe("useSelectSameType", () => {
  it("selects all nodes with same type as reference", () => {
    const { result } = renderHook(() => useSelectSameType());
    result.current.selectSameType("db1");
    expect(useCanvasStore.getState().selectedNodeIds).toEqual(
      expect.arrayContaining(["db1", "db2"]),
    );
  });

  it("does not select nodes of a different type", () => {
    const { result } = renderHook(() => useSelectSameType());
    result.current.selectSameType("db1");
    expect(useCanvasStore.getState().selectedNodeIds).not.toContain("api1");
  });

  it("excludes boundary nodes even if they share an id pattern", () => {
    const { result } = renderHook(() => useSelectSameType());
    result.current.selectSameType("db1");
    expect(useCanvasStore.getState().selectedNodeIds).not.toContain("b1");
  });

  it("no-ops when reference node does not exist", () => {
    const { result } = renderHook(() => useSelectSameType());
    result.current.selectSameType("nonexistent");
    expect(useCanvasStore.getState().selectedNodeIds).toHaveLength(0);
  });

  it("no-ops when reference is a boundary node", () => {
    const { result } = renderHook(() => useSelectSameType());
    result.current.selectSameType("b1");
    expect(useCanvasStore.getState().selectedNodeIds).toHaveLength(0);
  });

  it("selects single node when it is the only one of its type", () => {
    const { result } = renderHook(() => useSelectSameType());
    result.current.selectSameType("api1");
    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["api1"]);
  });
});
