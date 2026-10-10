/**
 * useHopHighlight tests
 *
 * Verifies the canvas-highlight reuse: highlighting a hop sets `chainHighlight`
 * on the matching node via the canvas store's updateNodeData (the same
 * primitive AttackChainOverlay uses), and clearing removes it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const updateNodeData = vi.fn();
const nodes = [
  { id: "n-edge", data: { label: "API Gateway" } },
  { id: "n-db", data: { label: "User Database" } },
];

vi.mock("@/stores/canvas", () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ nodes, updateNodeData }),
  ),
}));

import { useHopHighlight } from "./useHopHighlight";

const hop = {
  id: "hop-1",
  position: 1,
  componentId: "n-edge",
  componentName: "API Gateway",
  description: "x",
  isMitigated: false,
};

describe("useHopHighlight", () => {
  beforeEach(() => vi.clearAllMocks());

  it("highlights the matching node by componentId", () => {
    const { result } = renderHook(() => useHopHighlight());
    act(() => result.current.highlightHop(hop));
    expect(updateNodeData).toHaveBeenCalledWith("n-edge", {
      chainHighlight: "intermediate",
    });
  });

  it("falls back to matching by component name", () => {
    const { result } = renderHook(() => useHopHighlight());
    act(() =>
      result.current.highlightHop({
        ...hop,
        componentId: "missing",
        componentName: "User Database",
      }),
    );
    expect(updateNodeData).toHaveBeenCalledWith("n-db", {
      chainHighlight: "intermediate",
    });
  });

  it("clears the highlight", () => {
    const { result } = renderHook(() => useHopHighlight());
    act(() => result.current.highlightHop(hop));
    act(() => result.current.clearHop());
    expect(updateNodeData).toHaveBeenLastCalledWith("n-edge", {
      chainHighlight: undefined,
    });
  });

  it("ignores hops that match no node", () => {
    const { result } = renderHook(() => useHopHighlight());
    act(() =>
      result.current.highlightHop({
        ...hop,
        componentId: "nope",
        componentName: "nope",
      }),
    );
    expect(updateNodeData).not.toHaveBeenCalled();
  });
});
