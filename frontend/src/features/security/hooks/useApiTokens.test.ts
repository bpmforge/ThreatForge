/**
 * useApiTokens Hook Tests
 *
 * Tests for:
 * - useApiTokens: GET /api/users/me/api-tokens, returns token array
 * - useApiTokenScopes: GET /api/users/me/api-tokens/scopes, unwraps .scopes
 * - useCreateApiToken: POST, invalidates tokens cache on success, toasts error on failure
 * - useDeleteApiToken: DELETE, toasts success + invalidates cache, toasts error on failure
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import {
  useApiTokens,
  useApiTokenScopes,
  useCreateApiToken,
  useDeleteApiToken,
} from "./useApiTokens";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";

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
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

const makeToken = (overrides = {}) => ({
  id: "tok-1",
  name: "Test Token",
  tokenPrefix: "ftm_",
  scopes: ["threats:read"],
  lastUsedAt: null,
  usageCount: 0,
  expiresAt: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  revokedAt: null,
  ...overrides,
});

const makeScope = (overrides = {}) => ({
  value: "threats:read",
  label: "Read Threats",
  category: "Threats",
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useApiTokens", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  it("fetches and returns the tokens list", async () => {
    const tokens = [makeToken()];
    global.fetch = mockFetch({ data: tokens });

    const { result } = renderHook(() => useApiTokens(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(tokens);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/me/api-tokens",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});

describe("useApiTokenScopes", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  it("fetches scopes and returns the scopes array", async () => {
    const scopes = [makeScope()];
    // No { data } wrapper here, so the client returns the whole object
    global.fetch = mockFetch({ scopes });

    const { result } = renderHook(() => useApiTokenScopes(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(scopes);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/me/api-tokens/scopes",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});

describe("useCreateApiToken", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  it("calls POST and invalidates tokens cache on success", async () => {
    const token = makeToken();
    global.fetch = mockFetch({ data: { token: "raw_tok", apiToken: token } });
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCreateApiToken(), {
      wrapper: wrapper(client),
    });

    result.current.mutate({ name: "New Token", scopes: ["threats:read"] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/me/api-tokens",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(invalidate).toHaveBeenCalled();
  });

  it("toasts error on failure", async () => {
    global.fetch = mockFetch({ error: "Unauthorized" }, false, 401);

    const { result } = renderHook(() => useCreateApiToken(), {
      wrapper: wrapper(client),
    });

    result.current.mutate({ name: "New Token", scopes: [] });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith(
      "Failed to create token",
      expect.objectContaining({ description: "Unauthorized" }),
    );
  });
});

describe("useDeleteApiToken", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  it("calls DELETE, toasts success, and invalidates tokens cache", async () => {
    global.fetch = mockFetch({});
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useDeleteApiToken(), {
      wrapper: wrapper(client),
    });

    result.current.mutate("tok-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/me/api-tokens/tok-1",
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
    expect(toast.success).toHaveBeenCalledWith("Token deleted");
    expect(invalidate).toHaveBeenCalled();
  });

  it("toasts error on failure", async () => {
    global.fetch = mockFetch({ error: "Not found" }, false, 404);

    const { result } = renderHook(() => useDeleteApiToken(), {
      wrapper: wrapper(client),
    });

    result.current.mutate("tok-bad");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith(
      "Failed to delete token",
      expect.objectContaining({ description: "Not found" }),
    );
  });
});
