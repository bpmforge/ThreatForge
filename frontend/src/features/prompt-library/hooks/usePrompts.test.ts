/**
 * usePrompts Hook Tests
 *
 * Tests for:
 * - usePrompts: fetches for org with category; disabled when orgId undefined
 * - useBuiltInPrompts: always fetches
 * - usePrompt: fetches when both orgId and promptId defined; disabled when promptId undefined
 * - useCreatePrompt: calls api.createPrompt, invalidates cache, toast.success
 * - useClonePrompt: calls api.clonePrompt with promptId + name
 * - useDeletePrompt: calls api.deletePrompt, invalidates cache, toast.success
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import {
  usePrompts,
  useBuiltInPrompts,
  usePrompt,
  useCreatePrompt,
  useClonePrompt,
  useDeletePrompt,
} from "./usePrompts";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../services/api", () => ({
  getPrompts: vi.fn(),
  getBuiltInPrompts: vi.fn(),
  getPrompt: vi.fn(),
  createPrompt: vi.fn(),
  clonePrompt: vi.fn(),
  updatePrompt: vi.fn(),
  deletePrompt: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import * as api from "../services/api";
import { toast } from "sonner";
import type { PromptTemplate, PromptTemplateSummary } from "../types";

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

const makePromptSummary = (
  overrides: Partial<PromptTemplateSummary> = {},
): PromptTemplateSummary => ({
  id: "p-1",
  name: "Test Prompt",
  category: "EXTRACTION",
  outputFormat: "JSON",
  temperature: 0.2,
  maxTokens: 2000,
  requiresVision: false,
  tags: "[]",
  version: 1,
  isBuiltIn: false,
  isActive: true,
  organizationId: "org-1",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const makePromptTemplate = (
  overrides: Partial<PromptTemplate> = {},
): PromptTemplate => ({
  ...makePromptSummary(),
  userPromptTemplate: "Analyze: {{input}}",
  variables: "[]",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("usePrompts", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("fetches prompts for org with category", async () => {
    const prompts = [makePromptSummary()];
    vi.mocked(api.getPrompts).mockResolvedValue(prompts);

    const { result } = renderHook(
      () => usePrompts("org-1", "EXTRACTION" as never),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(prompts);
    expect(api.getPrompts).toHaveBeenCalledWith("org-1", "EXTRACTION");
  });

  it("is disabled when orgId is undefined", () => {
    renderHook(() => usePrompts(undefined), { wrapper: wrapper(client) });
    expect(api.getPrompts).not.toHaveBeenCalled();
  });
});

describe("useBuiltInPrompts", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("always fetches built-in prompts", async () => {
    const prompts = [
      makePromptSummary({ isBuiltIn: true, organizationId: undefined }),
    ];
    vi.mocked(api.getBuiltInPrompts).mockResolvedValue(prompts);

    const { result } = renderHook(() => useBuiltInPrompts(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(prompts);
    expect(api.getBuiltInPrompts).toHaveBeenCalled();
  });
});

describe("usePrompt", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("fetches a single prompt when both orgId and promptId are defined", async () => {
    const prompt = makePromptTemplate();
    vi.mocked(api.getPrompt).mockResolvedValue(prompt);

    const { result } = renderHook(() => usePrompt("org-1", "p-1"), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(prompt);
    expect(api.getPrompt).toHaveBeenCalledWith("org-1", "p-1");
  });

  it("is disabled when promptId is undefined", () => {
    renderHook(() => usePrompt("org-1", undefined), {
      wrapper: wrapper(client),
    });
    expect(api.getPrompt).not.toHaveBeenCalled();
  });
});

describe("useCreatePrompt", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("calls api.createPrompt, invalidates cache, and toasts success", async () => {
    const prompt = makePromptTemplate();
    vi.mocked(api.createPrompt).mockResolvedValue(prompt);
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCreatePrompt("org-1"), {
      wrapper: wrapper(client),
    });

    result.current.mutate({
      name: "New Prompt",
      category: "EXTRACTION" as never,
      systemPrompt: "You are an analyst.",
      userPromptTemplate: "Analyze: {{input}}",
      variables: "[]",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.createPrompt).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ name: "New Prompt" }),
    );
    expect(invalidate).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Prompt created successfully");
  });
});

describe("useClonePrompt", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("calls api.clonePrompt with promptId and name", async () => {
    const cloned = makePromptTemplate({
      id: "p-2",
      name: "Clone of Test Prompt",
    });
    vi.mocked(api.clonePrompt).mockResolvedValue(cloned);
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useClonePrompt("org-1"), {
      wrapper: wrapper(client),
    });

    result.current.mutate({ promptId: "p-1", name: "Clone of Test Prompt" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.clonePrompt).toHaveBeenCalledWith(
      "org-1",
      "p-1",
      "Clone of Test Prompt",
    );
    expect(invalidate).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Prompt cloned successfully");
  });
});

describe("useDeletePrompt", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("calls api.deletePrompt, invalidates cache, and toasts success", async () => {
    vi.mocked(api.deletePrompt).mockResolvedValue(undefined);
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useDeletePrompt("org-1"), {
      wrapper: wrapper(client),
    });

    result.current.mutate("p-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.deletePrompt).toHaveBeenCalledWith("org-1", "p-1");
    expect(invalidate).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Prompt deleted successfully");
  });
});
