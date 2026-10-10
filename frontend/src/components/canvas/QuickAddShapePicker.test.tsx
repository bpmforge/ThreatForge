import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    useReactFlow: () => ({
      screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
    }),
  };
});

// Minimal mock for component-configs to avoid icon rendering issues in jsdom
vi.mock("./component-configs", () => ({
  componentConfigs: {},
  defaultConfig: {
    Icon: ({ className }: { className?: string }) => (
      <span className={className} data-testid="icon" />
    ),
    color: "text-gray-500",
  },
}));

vi.mock("@/stores/canvas", () => ({
  getDefaultLabel: (type: string) => type.replace(/_/g, " ").toLowerCase(),
}));

import { QuickAddShapePicker } from "./QuickAddShapePicker";
import type { QuickAddState } from "@/hooks/useQuickAdd";

const STATE: QuickAddState = {
  x: 200,
  y: 300,
  sourceNodeId: "node-1",
  sourceHandleId: null,
};

const TOP5 = [
  "API",
  "DATABASE",
  "WEB_APP",
  "AUTH_SERVICE",
  "LOAD_BALANCER",
] as const;
type T5 = (typeof TOP5)[number];

function Wrapper({ onSelect = vi.fn(), onDismiss = vi.fn() } = {}) {
  return (
    <ReactFlowProvider>
      <QuickAddShapePicker
        state={STATE}
        top5={TOP5 as unknown as T5[]}
        onSelect={onSelect as never}
        onDismiss={onDismiss}
      />
    </ReactFlowProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("QuickAddShapePicker", () => {
  it("renders a button for each top-5 type", () => {
    render(<Wrapper />);
    TOP5.forEach((t) => {
      expect(
        screen.getByLabelText(`Add ${t.replace(/_/g, " ").toLowerCase()}`),
      ).toBeTruthy();
    });
  });

  it("calls onSelect with the type and flow position when a shape is clicked", () => {
    const onSelect = vi.fn();
    render(<Wrapper onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText("Add api"));
    expect(onSelect).toHaveBeenCalledWith(
      "API",
      expect.objectContaining({ x: expect.any(Number) }),
    );
  });

  it("calls onDismiss when Escape is pressed", () => {
    const onDismiss = vi.fn();
    render(<Wrapper onDismiss={onDismiss} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalled();
  });

  it("calls onDismiss when More… is clicked", () => {
    const onDismiss = vi.fn();
    render(<Wrapper onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText(/More/));
    expect(onDismiss).toHaveBeenCalled();
  });
});
