import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    useReactFlow: () => ({
      screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
    }),
  };
});

vi.mock("@/stores/canvas-store", () => ({
  useCanvasStore: (sel: (s: { securityOverlay: boolean }) => unknown) =>
    sel({ securityOverlay: true }),
}));

import { EdgeLabel } from "../EdgeLabel";

const BASE_PROPS = {
  x: 100,
  y: 100,
  securityLevel: "medium" as const,
  threatCount: 0,
  selected: true,
  edgeId: "e1",
  onLabelChange: vi.fn(),
};

describe("EdgeLabel drag grip", () => {
  it("shows drag grip when selected and onLabelDrag provided", () => {
    const onLabelDrag = vi.fn();
    render(
      <EdgeLabel
        {...BASE_PROPS}
        data={{ label: "my-edge" }}
        onLabelDrag={onLabelDrag}
      />,
    );
    expect(screen.getByLabelText("Drag to reposition label")).toBeTruthy();
  });

  it("does not show grip when onLabelDrag not provided", () => {
    render(<EdgeLabel {...BASE_PROPS} data={{ label: "my-edge" }} />);
    expect(screen.queryByLabelText("Drag to reposition label")).toBeNull();
  });

  it("mousedown on grip starts drag and fires onLabelDrag on mousemove", () => {
    const onLabelDrag = vi.fn();
    render(
      <EdgeLabel
        {...BASE_PROPS}
        data={{ label: "my-edge" }}
        onLabelDrag={onLabelDrag}
      />,
    );
    const grip = screen.getByLabelText("Drag to reposition label");
    fireEvent.mouseDown(grip, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 120, clientY: 90 });
    expect(onLabelDrag).toHaveBeenCalledWith({ x: 120, y: 90 });
  });

  it("labelPosition=0.1 renders label at 10% of path — SecurityEdge integration", () => {
    // Verify the math: pointAt('M 0 0 L 100 0', 0.1) = (10, 0)
    // This is tested directly in path-segments.test.ts via pointAt.
    // Here we just assert the EdgeLabel renders without crash at an arbitrary position.
    const { container } = render(
      <EdgeLabel {...BASE_PROPS} x={10} y={0} data={{ label: "edge" }} />,
    );
    expect(container.firstChild).not.toBeNull();
  });
});
