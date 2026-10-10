/**
 * useDFD hook tests — DFD-level query + mutation hooks.
 * Covers: service delegation, the `enabled` guard, and cache invalidation /
 * setQueryData on mutation success. Service layer is mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

vi.mock("../services/api", () => ({
  getDFDs: vi.fn(),
  getDFD: vi.fn(),
  createDFD: vi.fn(),
  updateDFD: vi.fn(),
  deleteDFD: vi.fn(),
}));
vi.mock("@/lib/mutation-helpers", () => ({
  defaultMutationErrorHandler: vi.fn(),
}));

import * as api from "../services/api";
import {
  useDFDs,
  useDFD,
  useCreateDFD,
  useUpdateDFD,
  useDeleteDFD,
} from "./useDFD";

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}
function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

beforeEach(() => vi.clearAllMocks());

describe("useDFDs / useDFD queries", () => {
  it("fetches DFDs for the model via the service", async () => {
    vi.mocked(api.getDFDs).mockResolvedValue([{ id: "d1" }] as never);
    const { result } = renderHook(() => useDFDs("m1"), {
      wrapper: wrapper(makeClient()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.getDFDs).toHaveBeenCalledWith("m1");
    expect(result.current.data).toEqual([{ id: "d1" }]);
  });

  it("useDFDs is disabled without a threatModelId", async () => {
    renderHook(() => useDFDs(undefined), { wrapper: wrapper(makeClient()) });
    await new Promise((r) => setTimeout(r, 20));
    expect(api.getDFDs).not.toHaveBeenCalled();
  });

  it("useDFD is disabled unless both model and dfd ids are present", async () => {
    renderHook(() => useDFD("m1", undefined), {
      wrapper: wrapper(makeClient()),
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(api.getDFD).not.toHaveBeenCalled();
  });
});

describe("DFD mutations", () => {
  it("useCreateDFD calls the service and invalidates the dfds list", async () => {
    vi.mocked(api.createDFD).mockResolvedValue({ id: "new" } as never);
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateDFD("m1"), {
      wrapper: wrapper(client),
    });
    await result.current.mutateAsync({
      name: "Flow",
      level: "CONTEXT",
    } as never);
    expect(api.createDFD).toHaveBeenCalledWith("m1", {
      name: "Flow",
      level: "CONTEXT",
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["dfds", "m1"] });
  });

  it("useDeleteDFD calls the service and invalidates the dfds list", async () => {
    vi.mocked(api.deleteDFD).mockResolvedValue(undefined as never);
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useDeleteDFD("m1"), {
      wrapper: wrapper(client),
    });
    await result.current.mutateAsync("d9");
    expect(api.deleteDFD).toHaveBeenCalledWith("m1", "d9");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["dfds", "m1"] });
  });

  it("useUpdateDFD seeds the single-DFD cache and invalidates the list", async () => {
    const updated = { id: "d1", name: "Renamed" };
    vi.mocked(api.updateDFD).mockResolvedValue(updated as never);
    const client = makeClient();
    const setData = vi.spyOn(client, "setQueryData");
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUpdateDFD("m1", "d1"), {
      wrapper: wrapper(client),
    });
    await result.current.mutateAsync({ name: "Renamed" } as never);
    expect(api.updateDFD).toHaveBeenCalledWith("m1", "d1", { name: "Renamed" });
    expect(setData).toHaveBeenCalledWith(["dfd", "m1", "d1"], updated);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["dfds", "m1"] });
  });
});
