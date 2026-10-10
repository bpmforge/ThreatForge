import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const apiPost = vi.fn();
const signOut = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiPost: (...a: unknown[]) => apiPost(...a),
}));
vi.mock("next-auth/react", () => ({
  signOut: (...a: unknown[]) => signOut(...a),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const { useRevokeAllSessions } = await import("./useSessions");

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

describe("useRevokeAllSessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("signs the caller out after the server revokes", async () => {
    apiPost.mockResolvedValue({});
    const { result } = renderHook(() => useRevokeAllSessions(), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(apiPost).toHaveBeenCalledWith(
      "/api/users/me/sessions/revoke-all",
      {},
    );
  });

  it("stays signed in when the server call fails", async () => {
    apiPost.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useRevokeAllSessions(), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(signOut).not.toHaveBeenCalled();
  });
});
