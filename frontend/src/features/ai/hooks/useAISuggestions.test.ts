/**
 * useAISuggestions Hook Tests
 *
 * Tests for:
 * - initial state: empty, not loading, no error
 * - suggestThreats (sync mode): calls api.suggestThreats, stores results
 * - suggestThreats (sync mode): handles error, clears loading
 * - suggestMitigations: calls api.suggestMitigations, stores results
 * - suggestMitigations: handles error
 * - clearSuggestions: resets all state
 * - no-op when modelId is null
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useAISuggestions } from "./useAISuggestions";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../services/api", () => ({
  suggestThreats: vi.fn(),
  suggestMitigations: vi.fn(),
  checkAIAvailability: vi.fn(),
  chat: vi.fn(),
  runMicroAnalysis: vi.fn(),
  refineThreat: vi.fn(),
}));

vi.mock("@/features/ai-jobs", () => ({
  useSubmitAiJob: () => ({
    submit: vi.fn(),
    isSubmitting: false,
    error: null,
  }),
}));

vi.mock("@/features/ai-jobs/hooks/useJobStatus", () => ({
  useJobStatus: () => ({ data: null }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import * as api from "../services/api";

const mockSuggestThreats = vi.mocked(api.suggestThreats);
const mockSuggestMitigations = vi.mocked(api.suggestMitigations);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const makeThreatInput = () => ({
  title: "SQL Injection",
  description: "Unparameterized queries",
  category: "TAMPERING",
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAISuggestions — initial state", () => {
  it("starts with empty state", () => {
    const client = makeClient();
    const { result } = renderHook(
      () => useAISuggestions({ modelId: "m-1", async: false }),
      { wrapper: wrapper(client) },
    );
    expect(result.current.threats).toEqual([]);
    expect(result.current.mitigations).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

describe("useAISuggestions — suggestThreats (sync)", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("stores returned threats on success", async () => {
    const threats = [
      {
        title: "SSRF",
        description: "Server-side request forgery",
        category: "INFO_DISCLOSURE" as const,
        severity: "HIGH" as const,
        confidence: 0.85,
      },
    ];
    mockSuggestThreats.mockResolvedValue(threats);

    const { result } = renderHook(
      () => useAISuggestions({ modelId: "m-1", async: false }),
      { wrapper: wrapper(client) },
    );

    await act(async () => {
      await result.current.suggestThreats();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.threats).toEqual(threats);
    expect(result.current.error).toBeNull();
  });

  it("sets error on failure", async () => {
    mockSuggestThreats.mockRejectedValue(new Error("AI offline"));

    const { result } = renderHook(
      () => useAISuggestions({ modelId: "m-1", async: false }),
      { wrapper: wrapper(client) },
    );

    await act(async () => {
      await result.current.suggestThreats();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("AI offline");
    expect(result.current.threats).toEqual([]);
  });

  it("does nothing when modelId is null", async () => {
    const { result } = renderHook(
      () => useAISuggestions({ modelId: null, async: false }),
      { wrapper: wrapper(client) },
    );

    await act(async () => {
      await result.current.suggestThreats();
    });

    expect(api.suggestThreats).not.toHaveBeenCalled();
    expect(result.current.threats).toEqual([]);
  });
});

describe("useAISuggestions — suggestMitigations", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("stores returned mitigations on success", async () => {
    const mitigations = [
      {
        title: "Parameterized Queries",
        description: "Use prepared statements",
        effectivenessScore: 0.9,
      },
    ];
    mockSuggestMitigations.mockResolvedValue(mitigations);

    const { result } = renderHook(
      () => useAISuggestions({ modelId: "m-1", async: false }),
      { wrapper: wrapper(client) },
    );

    await act(async () => {
      await result.current.suggestMitigations(makeThreatInput());
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.mitigations).toEqual(mitigations);
    expect(result.current.error).toBeNull();
  });

  it("sets error on failure", async () => {
    mockSuggestMitigations.mockRejectedValue(new Error("No mitigations"));

    const { result } = renderHook(
      () => useAISuggestions({ modelId: "m-1", async: false }),
      { wrapper: wrapper(client) },
    );

    await act(async () => {
      await result.current.suggestMitigations(makeThreatInput());
    });

    await waitFor(() => expect(result.current.error).toBe("No mitigations"));
  });

  it("does nothing when modelId is null", async () => {
    const { result } = renderHook(
      () => useAISuggestions({ modelId: null, async: false }),
      { wrapper: wrapper(client) },
    );

    await act(async () => {
      await result.current.suggestMitigations(makeThreatInput());
    });

    expect(api.suggestMitigations).not.toHaveBeenCalled();
  });
});

describe("useAISuggestions — clearSuggestions", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("resets threats, mitigations, and error", async () => {
    mockSuggestThreats.mockRejectedValue(new Error("Fail"));

    const { result } = renderHook(
      () => useAISuggestions({ modelId: "m-1", async: false }),
      { wrapper: wrapper(client) },
    );

    await act(async () => {
      await result.current.suggestThreats();
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());

    act(() => {
      result.current.clearSuggestions();
    });

    expect(result.current.threats).toEqual([]);
    expect(result.current.mitigations).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
