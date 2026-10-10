/**
 * Render-count guard: the model page hook (and the auto-save hook it hosts)
 * must not re-render on every drag frame. It used to subscribe to the whole
 * nodes array, so the entire model page re-rendered per frame.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCanvasStore } from "@/stores/canvas";
import { useUIStore } from "@/stores/ui-store";
import { useModelPage } from "./useModelPage";

const triggerSuggestions = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/features/ai", () => ({
  useExpertAnalysis: () => ({ result: null }),
}));
vi.mock("@/features/dashboard", () => ({
  useThreatModel: () => ({
    data: { id: "m1", name: "M", canvasState: undefined },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useThreatModels: () => ({ data: [] }),
}));
vi.mock("@/features/sequence-diagrams", () => ({
  useSequenceDiagrams: () => ({ data: undefined }),
}));
vi.mock("@/features/dfd", () => ({ useDFDs: () => ({ data: undefined }) }));
vi.mock("@/features/documents/services/api", () => ({
  getDocument: vi.fn(),
}));
vi.mock("@/features/document-import", () => ({
  extractArchitecture: vi.fn(),
  generateModel: vi.fn(),
}));
vi.mock("@/features/threat-assist/hooks/useAutoSuggestions", () => ({
  useAutoSuggestions: () => ({ triggerSuggestions }),
}));
vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const N = 20;
const FRAMES = 10;

function makeNodes(dx = 0, count = N) {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    type: "component" as const,
    position: { x: i * 200 + (i === 5 ? dx : 0), y: 0 },
    data: { label: `n${i}`, type: "API", trustLevel: "INTERNAL" as const },
  }));
}

function dragFrame(frame: number) {
  act(() => {
    useCanvasStore.setState({
      nodes: makeNodes(frame + 1) as never,
      isDirty: true,
    });
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  );
  useCanvasStore.setState({
    nodes: makeNodes() as never,
    edges: [],
    selectedNodeIds: [],
    selectedEdgeIds: [],
    isDirty: false,
  });
  triggerSuggestions.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useModelPage render count during a drag", () => {
  it("does not re-render the page on node position changes", () => {
    let renders = 0;
    renderHook(() => {
      renders++;
      return useModelPage("m1");
    });
    // First change flips isDirty, which the auto-save status legitimately
    // depends on; count only the drag frames after that.
    dragFrame(0);
    renders = 0;

    for (let f = 1; f <= FRAMES; f++) dragFrame(f);

    expect(renders).toBe(0);
  });

  it("still auto-saves the latest canvas once, 2s after the last frame", async () => {
    renderHook(() => useModelPage("m1"));
    for (let f = 0; f < FRAMES; f++) dragFrame(f);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const saves = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/save-canvas"),
    );
    expect(saves).toHaveLength(1);
    const body = JSON.parse((saves[0][1] as { body: string }).body);
    const n5 = body.nodes.find((n: { id: string }) => n.id === "n5");
    expect(n5.position.x).toBe(5 * 200 + FRAMES);
  });

  it("still triggers suggestions when a node is added", () => {
    renderHook(() => useModelPage("m1"));
    act(() => {
      useCanvasStore.setState({ nodes: makeNodes(0, N + 1) as never });
    });
    expect(triggerSuggestions).toHaveBeenCalledWith("n20", "API", "n20");
  });

  it("resolves the threat-catalog component", () => {
    act(() => {
      useUIStore.setState({ threatCatalogComponentId: "n3" });
    });
    const { result } = renderHook(() => useModelPage("m1"));
    expect(result.current.catalogComponent?.data?.label).toBe("n3");
    act(() => {
      useUIStore.setState({ threatCatalogComponentId: null });
    });
  });
});
