import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useCanvasStore } from "@/stores/canvas";
import { LegendNode } from "./LegendNode";
import type { NodeProps, Node } from "@xyflow/react";
import type { LegendNodeData } from "@/types/canvas";

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return { ...actual, NodeResizer: () => null };
});

// Minimal mock props satisfying NodeProps
const mockProps = {
  id: "legend-1",
  data: { label: "Legend" },
  selected: false,
  type: "legend",
  dragging: false,
  zIndex: 0,
  isConnectable: false,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
} as unknown as NodeProps<Node<LegendNodeData, "legend">>;

function makeComponent(id: string, type: string) {
  return {
    id,
    type: "component" as const,
    position: { x: 0, y: 0 },
    data: { label: id, type, trustLevel: "INTERNAL" as const },
  };
}

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    selectedNodeIds: [],
    selectedEdgeIds: [],
    isDirty: false,
  });
});

describe("LegendNode", () => {
  it("renders 'Legend' title", () => {
    render(<LegendNode {...mockProps} />);
    expect(screen.getByText("Legend")).toBeTruthy();
  });

  it("shows empty message when canvas has no components", () => {
    render(<LegendNode {...mockProps} />);
    expect(screen.getByText(/No components on canvas/i)).toBeTruthy();
  });

  it("renders one row per unique component type", () => {
    useCanvasStore.setState({
      nodes: [
        makeComponent("a", "DATABASE"),
        makeComponent("b", "DATABASE"),
        makeComponent("c", "API"),
      ],
    });
    render(<LegendNode {...mockProps} />);
    expect(screen.getByText("database")).toBeTruthy();
    expect(screen.getByText("api")).toBeTruthy();
    // Only two rows despite three nodes (DATABASE appears once)
    expect(screen.queryAllByText("database")).toHaveLength(1);
  });

  it("excludes legend nodes from the type list", () => {
    useCanvasStore.setState({
      nodes: [
        makeComponent("a", "DATABASE"),
        {
          id: "leg",
          type: "legend" as const,
          position: { x: 0, y: 0 },
          data: { label: "Legend" },
        },
      ],
    });
    render(<LegendNode {...mockProps} />);
    // Should show database but not a second legend entry
    expect(screen.getByText("database")).toBeTruthy();
    expect(screen.getAllByText("Legend")).toHaveLength(1); // only title
  });
});
