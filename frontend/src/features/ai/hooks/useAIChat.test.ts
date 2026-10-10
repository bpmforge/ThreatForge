/**
 * useAIChat Hook Tests
 *
 * Tests for:
 * - initial state: empty messages, not loading, no error
 * - sendMessage: no-ops when modelId is null or content is blank
 * - sendMessage: appends user message, calls api.chat, appends assistant reply
 * - sendMessage: sets error on failure, clears loading
 * - clearChat: resets messages and error
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAIChat } from "./useAIChat";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../services/api", () => ({
  chat: vi.fn(),
  suggestThreats: vi.fn(),
  suggestMitigations: vi.fn(),
  checkAIAvailability: vi.fn(),
  runMicroAnalysis: vi.fn(),
  refineThreat: vi.fn(),
}));

import * as api from "../services/api";

const mockChat = vi.mocked(api.chat);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAIChat — initial state", () => {
  it("starts with empty messages, not loading, no error", () => {
    const { result } = renderHook(() => useAIChat({ modelId: "model-1" }));
    expect(result.current.messages).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

describe("useAIChat — sendMessage guards", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does nothing when modelId is null", async () => {
    const { result } = renderHook(() => useAIChat({ modelId: null }));
    await act(async () => {
      await result.current.sendMessage("Hello");
    });
    expect(api.chat).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });

  it("does nothing when content is blank", async () => {
    const { result } = renderHook(() => useAIChat({ modelId: "model-1" }));
    await act(async () => {
      await result.current.sendMessage("   ");
    });
    expect(api.chat).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });
});

describe("useAIChat — sendMessage success", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds user message, calls api.chat, adds assistant reply", async () => {
    mockChat.mockResolvedValue({
      message: "Here is my threat analysis.",
      usage: { promptTokens: 50, completionTokens: 80, totalTokens: 130 },
    });

    const { result } = renderHook(() => useAIChat({ modelId: "model-1" }));

    await act(async () => {
      await result.current.sendMessage("What are the main threats?");
    });

    const msgs = result.current.messages;
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("user");
    expect(msgs[0].content).toBe("What are the main threats?");
    expect(msgs[1].role).toBe("assistant");
    expect(msgs[1].content).toBe("Here is my threat analysis.");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("passes conversation history to api.chat on subsequent messages", async () => {
    mockChat
      .mockResolvedValueOnce({
        message: "First reply",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      })
      .mockResolvedValueOnce({
        message: "Second reply",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      });

    const { result } = renderHook(() => useAIChat({ modelId: "model-1" }));

    await act(async () => {
      await result.current.sendMessage("First question");
    });
    await act(async () => {
      await result.current.sendMessage("Follow-up question");
    });

    // Second call should include the first exchange in history
    const secondCallHistory = mockChat.mock.calls[1][2];
    expect(secondCallHistory).toHaveLength(2); // user + assistant from first turn
    expect(secondCallHistory![0].role).toBe("user");
    expect(secondCallHistory![1].role).toBe("assistant");
  });

  it("trims whitespace from message content", async () => {
    mockChat.mockResolvedValue({
      message: "OK",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    });

    const { result } = renderHook(() => useAIChat({ modelId: "model-1" }));

    await act(async () => {
      await result.current.sendMessage("  trimmed  ");
    });

    expect(result.current.messages[0].content).toBe("trimmed");
    expect(mockChat).toHaveBeenCalledWith("model-1", "trimmed", []);
  });
});

describe("useAIChat — sendMessage failure", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets error and clears loading on API failure", async () => {
    mockChat.mockRejectedValue(new Error("AI unavailable"));

    const { result } = renderHook(() => useAIChat({ modelId: "model-1" }));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("AI unavailable");
    // User message is still in the list even on error
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe("user");
  });

  it("uses generic error message for non-Error rejections", async () => {
    mockChat.mockRejectedValue("string error");

    const { result } = renderHook(() => useAIChat({ modelId: "model-1" }));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    await waitFor(() => expect(result.current.error).toBe("Chat failed"));
  });
});

describe("useAIChat — clearChat", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resets messages and error", async () => {
    mockChat.mockRejectedValue(new Error("Fail"));
    const { result } = renderHook(() => useAIChat({ modelId: "model-1" }));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());

    act(() => {
      result.current.clearChat();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
