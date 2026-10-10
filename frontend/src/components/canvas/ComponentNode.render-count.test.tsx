/**
 * Render-count guard: dragging one node must not re-render every other
 * ComponentNode. NodeActionToolbar used to be mounted on every node and
 * pulled in useCanvasWithHistory, which subscribed to all nodes/edges.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Profiler, type ReactNode } from "react";
import { act, render, renderHook, screen } from "@testing-library/react";
import type { NodeProps, Node } from "@xyflow/react";
import { useCanvasStore } from "@/stores/canvas";
import { useHistoryStore } from "@/stores/history-store";
import { useCanvasWithHistory } from "@/hooks/useCanvasWithHistory";
import type { ComponentNodeData } from "@/types/canvas";
import { ComponentNode } from "./ComponentNode";

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    NodeResizer: () => null,
    NodeToolbar: ({
      isVisible,
      children,
    }: {
      isVisible?: boolean;
      children: ReactNode;
    }) => (isVisible ? <div>{children}</div> : null),
  };
});
// Leaf visuals need a React Flow provider; they are not under test.
vi.mock("./ComponentNodeHandles", () => ({ ComponentNodeHandles: () => null }));
vi.mock("./ComponentNodeInner", () => ({ ComponentNodeInner: () => null }));
vi.mock("./QuickConnectOverlay", () => ({ QuickConnectOverlay: () => null }));

const N = 20;
const FRAMES = 10;

function makeNodes(dx = 0) {
  return Array.from({ length: N }, (_, i) => ({
    id: `n${i}`,
    type: "component" as const,
    position: { x: i * 200 + (i === 5 ? dx : 0), y: 0 },
    data: { label: `n${i}`, type: "API", trustLevel: "INTERNAL" as const },
  }));
}

/** One drag frame of node n5, the way applyNodeChanges produces it. */
function dragFrame(frame: number) {
  act(() => {
    useCanvasStore.setState({
      nodes: makeNodes(frame + 1) as never,
      isDirty: true,
    });
  });
}

function props(id: string, selected: boolean) {
  return {
    id,
    data: { label: id, type: "API", trustLevel: "INTERNAL" },
    selected,
    type: "component",
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  } as unknown as NodeProps<Node<ComponentNodeData, "component">>;
}

beforeEach(() => {
  useCanvasStore.setState({
    nodes: makeNodes() as never,
    edges: [],
    selectedNodeIds: [],
    selectedEdgeIds: [],
    isDirty: false,
  });
  useHistoryStore.getState().clear();
});

describe("ComponentNode render count during a drag", () => {
  it("does not re-render an unselected node while another node moves", () => {
    let commits = 0;
    render(
      <Profiler id="node" onRender={() => commits++}>
        <ComponentNode {...props("n0", false)} />
      </Profiler>,
    );
    commits = 0;

    for (let f = 0; f < FRAMES; f++) dragFrame(f);

    expect(commits).toBe(0);
  });

  it("still shows the action toolbar on the single selected node", () => {
    useCanvasStore.setState({ selectedNodeIds: ["n0"] });
    render(<ComponentNode {...props("n0", true)} />);
    expect(screen.getByLabelText("Duplicate node")).toBeInTheDocument();
  });

  it("hides the toolbar when the node is not the single selection", () => {
    useCanvasStore.setState({ selectedNodeIds: ["n0", "n1"] });
    render(<ComponentNode {...props("n0", true)} />);
    expect(screen.queryByLabelText("Duplicate node")).toBeNull();
  });
});

describe("useCanvasWithHistory", () => {
  it("does not re-render its host on node moves", () => {
    let renders = 0;
    renderHook(() => {
      renders++;
      return useCanvasWithHistory();
    });
    renders = 0;

    for (let f = 0; f < FRAMES; f++) dragFrame(f);

    expect(renders).toBe(0);
  });

  it("records the canvas as it is at call time, not at last render", () => {
    const { result } = renderHook(() => useCanvasWithHistory());
    for (let f = 0; f < FRAMES; f++) dragFrame(f);

    act(() => result.current.bringToFront("n5"));

    const past = useHistoryStore.getState().past;
    const snap = past[past.length - 1].snapshot;
    const n5 = snap.nodes.find((n) => n.id === "n5");
    expect(n5?.position.x).toBe(5 * 200 + FRAMES);
  });
});
