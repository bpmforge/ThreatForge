/**
 * useScanners hook tests — query hooks for scanner findings/stats/history.
 * Covers: URL + filter-param construction, { data } unwrapping, the `enabled`
 * guard (no fetch without an id), and error propagation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useFindings, useFindingStats, useScanHistory } from "./useScanners";

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

function mockFetch(body: unknown, ok = true) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue({ ok, json: async () => body } as Response);
}

function fetchedUrl(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.at(-1)?.[0] as string;
}

afterEach(() => vi.restoreAllMocks());

describe("useFindings", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("fetches the project findings endpoint and unwraps { data }", async () => {
    const spy = mockFetch({ data: [{ id: "f1" }] });
    const { result } = renderHook(() => useFindings("p1"), {
      wrapper: wrapper(makeClient()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "f1" }]);
    expect(fetchedUrl(spy)).toContain("/api/projects/p1/scanners/findings?");
  });

  it("encodes scannerType, comma-joined severity, and status filters", async () => {
    const spy = mockFetch({ data: [] });
    const { result } = renderHook(
      () =>
        useFindings("p1", {
          scannerType: "SNYK",
          severity: ["CRITICAL", "HIGH"],
          status: "OPEN",
        }),
      { wrapper: wrapper(makeClient()) },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = fetchedUrl(spy);
    expect(url).toContain("scannerType=SNYK");
    expect(url).toContain("severity=CRITICAL%2CHIGH"); // comma-encoded
    expect(url).toContain("status=OPEN");
  });

  it("is disabled (no fetch) when projectId is undefined", async () => {
    const spy = mockFetch({ data: [] });
    renderHook(() => useFindings(undefined), {
      wrapper: wrapper(makeClient()),
    });
    // give the query a tick; enabled:false must keep fetch untouched
    await new Promise((r) => setTimeout(r, 20));
    expect(spy).not.toHaveBeenCalled();
  });

  it("surfaces an error when the response is not ok", async () => {
    mockFetch({}, false);
    const { result } = renderHook(() => useFindings("p1"), {
      wrapper: wrapper(makeClient()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe("useFindingStats / useScanHistory", () => {
  it("stats hits the stats endpoint", async () => {
    const spy = mockFetch({ data: { total: 3 } });
    const { result } = renderHook(() => useFindingStats("p1"), {
      wrapper: wrapper(makeClient()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchedUrl(spy)).toBe("/api/projects/p1/scanners/findings/stats");
    expect(result.current.data).toEqual({ total: 3 });
  });

  it("history hits the history endpoint", async () => {
    const spy = mockFetch({ data: [{ id: "run1" }] });
    const { result } = renderHook(() => useScanHistory("p1"), {
      wrapper: wrapper(makeClient()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchedUrl(spy)).toBe("/api/projects/p1/scanners/history");
  });

  it("stats is disabled without a projectId", async () => {
    const spy = mockFetch({ data: {} });
    renderHook(() => useFindingStats(undefined), {
      wrapper: wrapper(makeClient()),
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(spy).not.toHaveBeenCalled();
  });
});
