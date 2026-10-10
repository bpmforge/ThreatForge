/**
 * useThreats Hook Tests
 *
 * Tests for:
 * - THREAT_QUERY_KEYS (query key helpers)
 * - useThreats (list query — enabled guard, data fetching)
 * - useCreateThreat (mutation — API call, cache update on success, error toast)
 * - useUpdateThreat (mutation — API call, cache update on success, error toast)
 * - useDeleteThreat (mutation — API call, cache removal on success, error toast)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import {
  THREAT_QUERY_KEYS,
  useThreats,
  useCreateThreat,
  useUpdateThreat,
  useDeleteThreat,
} from "./useThreats";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../services/api", () => ({
  fetchThreats: vi.fn(),
  createThreat: vi.fn(),
  updateThreat: vi.fn(),
  deleteThreat: vi.fn(),
  updateThreatStatus: vi.fn(),
  createMitigation: vi.fn(),
  updateMitigationStatus: vi.fn(),
  updateMitigation: vi.fn(),
  deleteMitigation: vi.fn(),
  moveMitigation: vi.fn(),
  fetchThreatComments: vi.fn(),
  createThreatComment: vi.fn(),
  deleteThreatComment: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import * as api from "../services/api";
import { toast } from "sonner";
import type { StrideCategory, Severity } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Build a fresh QueryClient with retries disabled (prevents test hangs). */
function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

/** Wrap renderHook calls with a QueryClientProvider. */
function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

/** Minimal Threat fixture. */
const makeThreat = (overrides: Record<string, unknown> = {}) => ({
  id: "threat-1",
  name: "SQL Injection",
  description: "Attacker injects SQL via input fields.",
  strideCategories: ["TAMPERING"] as StrideCategory[],
  severity: "HIGH" as Severity,
  status: "OPEN",
  mitigations: [],
  cweIds: [],
  owaspIds: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// THREAT_QUERY_KEYS
// ---------------------------------------------------------------------------

describe("THREAT_QUERY_KEYS", () => {
  describe("threats", () => {
    it("generates correct query key for threats list", () => {
      expect(THREAT_QUERY_KEYS.threats("model-123")).toEqual([
        "threats",
        "model-123",
      ]);
    });

    it("generates different keys for different models", () => {
      expect(THREAT_QUERY_KEYS.threats("model-1")).not.toEqual(
        THREAT_QUERY_KEYS.threats("model-2"),
      );
    });

    it("returns a two-element array", () => {
      const key = THREAT_QUERY_KEYS.threats("model-123");
      expect(Array.isArray(key)).toBe(true);
      expect(key.length).toBe(2);
    });
  });

  describe("threat", () => {
    it("generates correct query key for a single threat", () => {
      expect(THREAT_QUERY_KEYS.threat("model-123", "threat-456")).toEqual([
        "threats",
        "model-123",
        "threat-456",
      ]);
    });

    it("includes threat ID in key at index 2", () => {
      expect(THREAT_QUERY_KEYS.threat("model-1", "threat-abc")[2]).toBe(
        "threat-abc",
      );
    });

    it("generates unique keys for different threats in same model", () => {
      expect(THREAT_QUERY_KEYS.threat("model-1", "threat-1")).not.toEqual(
        THREAT_QUERY_KEYS.threat("model-1", "threat-2"),
      );
    });

    it("generates unique keys for same threat in different models", () => {
      expect(THREAT_QUERY_KEYS.threat("model-1", "threat-1")).not.toEqual(
        THREAT_QUERY_KEYS.threat("model-2", "threat-1"),
      );
    });
  });

  describe("comments", () => {
    it("generates a three-segment key for comments", () => {
      const key = THREAT_QUERY_KEYS.comments("model-1", "threat-1");
      expect(key).toEqual(["threat-comments", "model-1", "threat-1"]);
    });
  });
});

// ---------------------------------------------------------------------------
// useThreats
// ---------------------------------------------------------------------------

describe("useThreats", () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeClient();
  });

  it("is disabled when modelId is null", () => {
    const { result } = renderHook(() => useThreats(null), {
      wrapper: wrapper(client),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("is disabled when modelId is undefined", () => {
    const { result } = renderHook(() => useThreats(undefined), {
      wrapper: wrapper(client),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("fetches threats when modelId is provided", async () => {
    const mockThreats = [
      makeThreat(),
      makeThreat({ id: "threat-2", name: "XSS" }),
    ];
    vi.mocked(api.fetchThreats).mockResolvedValue(mockThreats);

    const { result } = renderHook(() => useThreats("model-123"), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.fetchThreats).toHaveBeenCalledWith("model-123", {
      sinceLastSignOff: false,
    });
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].id).toBe("threat-1");
  });

  it("exposes error state when fetch fails", async () => {
    vi.mocked(api.fetchThreats).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useThreats("model-fail"), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useCreateThreat
// ---------------------------------------------------------------------------

describe("useCreateThreat", () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeClient();
  });

  it("calls api.createThreat with correct arguments", async () => {
    const newThreat = makeThreat({ id: "threat-new" });
    vi.mocked(api.createThreat).mockResolvedValue(newThreat);

    const { result } = renderHook(() => useCreateThreat("model-123"), {
      wrapper: wrapper(client),
    });

    result.current.mutate({
      name: "SQL Injection",
      strideCategories: ["TAMPERING"] as StrideCategory[],
      severity: "HIGH",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.createThreat).toHaveBeenCalledWith("model-123", {
      name: "SQL Injection",
      strideCategories: ["TAMPERING"] as StrideCategory[],
      severity: "HIGH",
    });
  });

  it("prepends new threat to cache on success", async () => {
    const existingThreat = makeThreat({ id: "threat-existing" });
    const newThreat = makeThreat({ id: "threat-new", name: "New Threat" });

    // Seed cache with existing threat
    client.setQueryData(THREAT_QUERY_KEYS.threats("model-123"), [
      existingThreat,
    ]);

    vi.mocked(api.createThreat).mockResolvedValue(newThreat);

    const { result } = renderHook(() => useCreateThreat("model-123"), {
      wrapper: wrapper(client),
    });

    result.current.mutate({
      name: "New Threat",
      strideCategories: ["SPOOFING"],
      severity: "MEDIUM",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = client.getQueryData<unknown[]>(
      THREAT_QUERY_KEYS.threats("model-123"),
    );
    expect(cached).toHaveLength(2);
    expect((cached?.[0] as { id: string }).id).toBe("threat-new");
    expect((cached?.[1] as { id: string }).id).toBe("threat-existing");
  });

  it("initialises cache with single-item array when cache was empty", async () => {
    const newThreat = makeThreat({ id: "threat-first" });
    vi.mocked(api.createThreat).mockResolvedValue(newThreat);

    const { result } = renderHook(() => useCreateThreat("model-empty"), {
      wrapper: wrapper(client),
    });

    result.current.mutate({
      name: "First Threat",
      strideCategories: ["DENIAL_OF_SERVICE"],
      severity: "LOW",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = client.getQueryData<unknown[]>(
      THREAT_QUERY_KEYS.threats("model-empty"),
    );
    expect(cached).toHaveLength(1);
    expect((cached?.[0] as { id: string }).id).toBe("threat-first");
  });

  it("shows error toast when API call fails", async () => {
    vi.mocked(api.createThreat).mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useCreateThreat("model-123"), {
      wrapper: wrapper(client),
    });

    result.current.mutate({
      name: "Bad Threat",
      strideCategories: ["TAMPERING"] as StrideCategory[],
      severity: "HIGH",
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Failed to create threat");
  });

  it("throws when modelId is null", async () => {
    vi.mocked(api.createThreat).mockResolvedValue(makeThreat());

    const { result } = renderHook(() => useCreateThreat(null), {
      wrapper: wrapper(client),
    });

    result.current.mutate({
      name: "Test",
      strideCategories: ["TAMPERING"] as StrideCategory[],
      severity: "HIGH",
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(api.createThreat).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useUpdateThreat
// ---------------------------------------------------------------------------

describe("useUpdateThreat", () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeClient();
  });

  it("calls api.updateThreat with correct arguments", async () => {
    const updatedThreat = makeThreat({ severity: "CRITICAL" });
    vi.mocked(api.updateThreat).mockResolvedValue(updatedThreat);

    const { result } = renderHook(() => useUpdateThreat("model-123"), {
      wrapper: wrapper(client),
    });

    result.current.mutate({
      threatId: "threat-1",
      data: { severity: "CRITICAL" },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.updateThreat).toHaveBeenCalledWith("model-123", "threat-1", {
      severity: "CRITICAL",
    });
  });

  it("replaces updated threat in cache on success", async () => {
    const original = makeThreat({ id: "threat-1", severity: "HIGH" });
    const updated = makeThreat({ id: "threat-1", severity: "CRITICAL" });
    const other = makeThreat({ id: "threat-2", name: "Other" });

    client.setQueryData(THREAT_QUERY_KEYS.threats("model-123"), [
      original,
      other,
    ]);
    vi.mocked(api.updateThreat).mockResolvedValue(updated);

    const { result } = renderHook(() => useUpdateThreat("model-123"), {
      wrapper: wrapper(client),
    });

    result.current.mutate({
      threatId: "threat-1",
      data: { severity: "CRITICAL" },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = client.getQueryData<Array<{ id: string; severity: string }>>(
      THREAT_QUERY_KEYS.threats("model-123"),
    );
    expect(cached).toHaveLength(2);
    expect(cached?.find((t) => t.id === "threat-1")?.severity).toBe("CRITICAL");
  });

  it("shows error toast when update fails", async () => {
    vi.mocked(api.updateThreat).mockRejectedValue(new Error("Update failed"));

    const { result } = renderHook(() => useUpdateThreat("model-123"), {
      wrapper: wrapper(client),
    });

    result.current.mutate({
      threatId: "threat-1",
      data: { severity: "CRITICAL" },
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Failed to update threat");
  });

  it("does not call API when modelId is null", async () => {
    const { result } = renderHook(() => useUpdateThreat(null), {
      wrapper: wrapper(client),
    });

    result.current.mutate({ threatId: "threat-1", data: { severity: "LOW" } });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(api.updateThreat).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useDeleteThreat
// ---------------------------------------------------------------------------

describe("useDeleteThreat", () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeClient();
  });

  it("calls api.deleteThreat with correct threatId", async () => {
    vi.mocked(api.deleteThreat).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteThreat("model-123"), {
      wrapper: wrapper(client),
    });

    result.current.mutate("threat-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.deleteThreat).toHaveBeenCalledWith("model-123", "threat-1");
  });

  it("removes deleted threat from cache on success", async () => {
    const threat1 = makeThreat({ id: "threat-1" });
    const threat2 = makeThreat({ id: "threat-2", name: "XSS" });

    client.setQueryData(THREAT_QUERY_KEYS.threats("model-123"), [
      threat1,
      threat2,
    ]);
    vi.mocked(api.deleteThreat).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteThreat("model-123"), {
      wrapper: wrapper(client),
    });

    result.current.mutate("threat-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = client.getQueryData<Array<{ id: string }>>(
      THREAT_QUERY_KEYS.threats("model-123"),
    );
    expect(cached).toHaveLength(1);
    expect(cached?.[0].id).toBe("threat-2");
  });

  it("does not remove other threats from cache", async () => {
    const threat1 = makeThreat({ id: "threat-1" });
    const threat2 = makeThreat({ id: "threat-2" });
    const threat3 = makeThreat({ id: "threat-3" });

    client.setQueryData(THREAT_QUERY_KEYS.threats("model-123"), [
      threat1,
      threat2,
      threat3,
    ]);
    vi.mocked(api.deleteThreat).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteThreat("model-123"), {
      wrapper: wrapper(client),
    });

    result.current.mutate("threat-2");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = client.getQueryData<Array<{ id: string }>>(
      THREAT_QUERY_KEYS.threats("model-123"),
    );
    expect(cached).toHaveLength(2);
    expect(cached?.map((t) => t.id)).toEqual(["threat-1", "threat-3"]);
  });

  it("shows error toast when delete fails", async () => {
    vi.mocked(api.deleteThreat).mockRejectedValue(new Error("Delete failed"));

    const { result } = renderHook(() => useDeleteThreat("model-123"), {
      wrapper: wrapper(client),
    });

    result.current.mutate("threat-1");

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Failed to delete threat");
  });

  it("does not call API when modelId is null", async () => {
    const { result } = renderHook(() => useDeleteThreat(null), {
      wrapper: wrapper(client),
    });

    result.current.mutate("threat-1");

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(api.deleteThreat).not.toHaveBeenCalled();
  });
});
