/**
 * useCompliance Hook Tests
 *
 * Tests for:
 * - initial: isLoading=true, data=null, error=null before fetch resolves
 * - success: fetches correct URL with framework query param, returns data
 * - error: non-ok response sets error to 'Failed to fetch compliance data'
 * - framework passed correctly in query string
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useCompliance } from "./useCompliance";

// ---------------------------------------------------------------------------
// fetch mock helpers
// ---------------------------------------------------------------------------

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

const makeAnalysis = (overrides = {}) => ({
  modelId: "model-1",
  framework: "HIPAA" as const,
  totalControls: 100,
  coveredControls: 70,
  partialControls: 15,
  gaps: [],
  coveragePercentage: 70,
  lastAnalyzed: new Date().toISOString(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useCompliance", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  it("starts with isLoading=true, data=null, error=null", () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useCompliance("model-1", "HIPAA"), {
      wrapper: wrapper(client),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("returns compliance data on success", async () => {
    const analysis = makeAnalysis();
    global.fetch = mockFetch(analysis);

    const { result } = renderHook(() => useCompliance("model-1", "HIPAA"), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(analysis);
    expect(result.current.error).toBeNull();
  });

  it("fetches the correct URL with model id and framework", async () => {
    global.fetch = mockFetch(makeAnalysis());

    renderHook(() => useCompliance("model-42", "HIPAA"), {
      wrapper: wrapper(client),
    });

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/threat-models/model-42/compliance?framework=HIPAA",
        expect.anything(),
      ),
    );
  });

  it("passes the framework query parameter correctly", async () => {
    global.fetch = mockFetch(makeAnalysis({ framework: "PCI_DSS" }));

    renderHook(() => useCompliance("model-1", "PCI_DSS"), {
      wrapper: wrapper(client),
    });

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/threat-models/model-1/compliance?framework=PCI_DSS",
        expect.anything(),
      ),
    );
  });

  it("sets error when response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);

    const { result } = renderHook(() => useCompliance("model-1", "HIPAA"), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe(
      "Failed to fetch compliance data",
    );
    expect(result.current.data).toBeNull();
  });
});
