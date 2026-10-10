import { describe, it, expect, beforeEach } from "vitest";
import {
  useCanvasStore,
  type CanvasEdge,
  type CanvasNode,
} from "@/stores/canvas";
import { normalizeEdgeHandles } from "./persistence-slice";

const edge = (
  sourceHandle: string | undefined,
  targetHandle: string | undefined,
  data: Record<string, unknown> = {},
): CanvasEdge =>
  ({
    id: "e1",
    source: "a",
    target: "b",
    type: "security",
    sourceHandle,
    targetHandle,
    data,
  }) as unknown as CanvasEdge;

describe("normalizeEdgeHandles", () => {
  it("leaves built-in handle ids untouched", () => {
    const [out] = normalizeEdgeHandles([edge("handle-right", "handle-left")]);
    expect(out.sourceHandle).toBe("handle-right");
    expect(out.targetHandle).toBe("handle-left");
  });

  it("repairs handles mangled by the old normalizer and drops the bogus interface ids", () => {
    // Saved while the bug was live: React Flow dropped this edge (#008).
    const [out] = normalizeEdgeHandles([
      edge("handle-left-s-source", "handle-right-t-target", {
        sourceInterfaceId: "handle-left-s",
        targetInterfaceId: "handle-right-t",
      }),
    ]);
    expect(out.sourceHandle).toBe("handle-left-s");
    expect(out.targetHandle).toBe("handle-right-t");
    expect(out.data?.sourceInterfaceId).toBeUndefined();
    expect(out.data?.targetInterfaceId).toBeUndefined();
  });

  it("still suffixes real interface handles", () => {
    const [out] = normalizeEdgeHandles([
      edge("iface-1", undefined, {
        sourceInterfaceId: "iface-1",
        targetInterfaceId: "iface-2",
      }),
    ]);
    expect(out.sourceHandle).toBe("iface-1-source");
    expect(out.targetHandle).toBe("iface-2-target");
  });

  it("does not double-suffix interface handles", () => {
    const [out] = normalizeEdgeHandles([
      edge("iface-1-source", "iface-2-target", {
        sourceInterfaceId: "iface-1",
        targetInterfaceId: "iface-2",
      }),
    ]);
    expect(out.sourceHandle).toBe("iface-1-source");
    expect(out.targetHandle).toBe("iface-2-target");
  });
});

describe("loadCanvas", () => {
  beforeEach(() => {
    useCanvasStore.getState().clearCanvas();
  });

  it("orders parents before children and strips extent:parent", () => {
    const nodes = [
      {
        id: "child",
        type: "component",
        position: { x: 10, y: 10 },
        parentId: "boundary",
        extent: "parent",
        data: { label: "C", type: "API", trustLevel: "INTERNAL" },
      },
      {
        id: "boundary",
        type: "boundary",
        position: { x: 0, y: 0 },
        style: { width: 400, height: 300 },
        data: { label: "B", trustLevel: "INTERNAL" },
      },
    ] as unknown as CanvasNode[];

    useCanvasStore.getState().loadCanvas(nodes, []);

    const loaded = useCanvasStore.getState().nodes;
    expect(loaded.map((n) => n.id)).toEqual(["boundary", "child"]);
    expect(loaded[1].extent).toBeUndefined();
    expect(loaded[1].parentId).toBe("boundary");
  });
});

describe("deleteSelected", () => {
  it("keeps a deleted boundary's children at their absolute position, unparented", () => {
    useCanvasStore.setState({
      nodes: [
        {
          id: "b",
          type: "boundary",
          position: { x: 100, y: 100 },
          style: { width: 400, height: 300 },
          data: { label: "B", trustLevel: "INTERNAL" },
        },
        {
          id: "c",
          type: "component",
          position: { x: 50, y: 60 },
          parentId: "b",
          data: { label: "C", type: "API", trustLevel: "INTERNAL" },
        },
      ] as unknown as CanvasNode[],
      edges: [],
      selectedNodeIds: ["b"],
      selectedEdgeIds: [],
      isDirty: false,
    });
    useCanvasStore.getState().deleteSelected();
    const c = useCanvasStore.getState().nodes.find((n) => n.id === "c")!;
    expect(c).toBeDefined();
    expect(c.parentId).toBeUndefined();
    expect(c.position).toEqual({ x: 150, y: 160 });
  });
});
