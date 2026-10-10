/**
 * useSubmitAiJob: HTTP 429 (org AI quota) surfaces the server message.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import {
  useSubmitAiJob,
  AiQuotaExceededError,
  aiJobErrorMessage,
} from "./useSubmitAiJob";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient() }, children);

describe("useSubmitAiJob quota handling", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "AI monthly spend cap reached ($10.00 of $10.00).",
            code: "AI_QUOTA_EXCEEDED",
          }),
          { status: 429 },
        ),
      ),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("throws AiQuotaExceededError carrying the server message", async () => {
    const { result } = renderHook(() => useSubmitAiJob(), { wrapper });
    const err = await result.current.submit("/api/x", {}).catch((e) => e);
    expect(err).toBeInstanceOf(AiQuotaExceededError);
    expect(aiJobErrorMessage(err, "Failed to start")).toBe(
      "AI monthly spend cap reached ($10.00 of $10.00).",
    );
  });

  it("aiJobErrorMessage falls back for non-quota errors", () => {
    expect(aiJobErrorMessage(new Error("boom"), "Failed to start")).toBe(
      "Failed to start",
    );
  });
});
