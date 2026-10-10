/**
 * Prompt Library API Service Tests
 *
 * Tests for:
 * - getPrompts: unwraps .prompts, appends category query param
 * - getBuiltInPrompts: fetches from /api/prompts/builtin
 * - getPrompt: unwraps .prompt envelope
 * - createPrompt: posts input, unwraps .prompt
 * - clonePrompt: posts to clone endpoint, unwraps .prompt
 * - updatePrompt: puts input, unwraps .prompt
 * - deletePrompt: calls apiDelete
 * - previewPrompt: posts variables, returns preview result
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPrompts,
  getBuiltInPrompts,
  getPrompt,
  createPrompt,
  clonePrompt,
  updatePrompt,
  deletePrompt,
  previewPrompt,
} from "./api";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/api-client", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";

const mockGet = vi.mocked(apiGet);
const mockPost = vi.mocked(apiPost);
const mockPut = vi.mocked(apiPut);
const mockDelete = vi.mocked(apiDelete);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makePromptSummary = (overrides = {}) => ({
  id: "prompt-1",
  name: "Test Prompt",
  category: "EXTRACTION",
  isBuiltIn: false,
  orgId: "org-1",
  ...overrides,
});

const makePrompt = (overrides = {}) => ({
  ...makePromptSummary(),
  userPromptTemplate: "Analyze: {{doc}}",
  outputFormat: "JSON",
  temperature: 0.3,
  maxTokens: 2000,
  requiresVision: false,
  variables: "[]",
  tags: "[]",
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getPrompts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns prompts array from response envelope", async () => {
    const prompts = [makePromptSummary()];
    mockGet.mockResolvedValue({ prompts });

    const result = await getPrompts("org-1");
    expect(result).toEqual(prompts);
    expect(apiGet).toHaveBeenCalledWith("/api/organizations/org-1/prompts");
  });

  it("appends category query param when provided", async () => {
    mockGet.mockResolvedValue({ prompts: [] });

    await getPrompts("org-1", "EXTRACTION");
    expect(apiGet).toHaveBeenCalledWith(
      "/api/organizations/org-1/prompts?category=EXTRACTION",
    );
  });
});

describe("getBuiltInPrompts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches from builtin endpoint and unwraps prompts", async () => {
    const prompts = [makePromptSummary({ isBuiltIn: true })];
    mockGet.mockResolvedValue({ prompts });

    const result = await getBuiltInPrompts();
    expect(result).toEqual(prompts);
    expect(apiGet).toHaveBeenCalledWith("/api/prompts/builtin");
  });
});

describe("getPrompt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches single prompt and unwraps .prompt envelope", async () => {
    const prompt = makePrompt();
    mockGet.mockResolvedValue({ prompt });

    const result = await getPrompt("org-1", "prompt-1");
    expect(result).toEqual(prompt);
    expect(apiGet).toHaveBeenCalledWith(
      "/api/organizations/org-1/prompts/prompt-1",
    );
  });
});

describe("createPrompt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts input and returns created prompt from .prompt envelope", async () => {
    const prompt = makePrompt();
    mockPost.mockResolvedValue({ prompt });

    const input = {
      name: "Test",
      category: "EXTRACTION" as const,
      systemPrompt: "",
      userPromptTemplate: "Analyze: {{doc}}",
      outputFormat: "JSON" as const,
      temperature: 0.3,
      maxTokens: 2000,
      requiresVision: false,
    };
    const result = await createPrompt("org-1", input);
    expect(result).toEqual(prompt);
    expect(apiPost).toHaveBeenCalledWith(
      "/api/organizations/org-1/prompts",
      input,
    );
  });
});

describe("clonePrompt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts to clone endpoint and returns cloned prompt", async () => {
    const cloned = makePrompt({ id: "prompt-2", name: "Test Prompt (Copy)" });
    mockPost.mockResolvedValue({ prompt: cloned });

    const result = await clonePrompt("org-1", "prompt-1");
    expect(result).toEqual(cloned);
    expect(apiPost).toHaveBeenCalledWith(
      "/api/organizations/org-1/prompts/prompt-1/clone",
      {},
    );
  });
});

describe("updatePrompt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("puts update and returns updated prompt", async () => {
    const updated = makePrompt({ name: "Updated" });
    mockPut.mockResolvedValue({ prompt: updated });

    const result = await updatePrompt("org-1", "prompt-1", { name: "Updated" });
    expect(result).toEqual(updated);
    expect(apiPut).toHaveBeenCalledWith(
      "/api/organizations/org-1/prompts/prompt-1",
      { name: "Updated" },
    );
  });
});

describe("deletePrompt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls apiDelete with correct endpoint", async () => {
    mockDelete.mockResolvedValue(undefined);

    await deletePrompt("org-1", "prompt-1");
    expect(apiDelete).toHaveBeenCalledWith(
      "/api/organizations/org-1/prompts/prompt-1",
    );
  });
});

describe("previewPrompt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts promptId + variables to the preview endpoint", async () => {
    const previewResult = { userPrompt: "Analyze: some document text" };
    mockPost.mockResolvedValue(previewResult);

    const result = await previewPrompt("org-1", "prompt-1", {
      doc: "some document text",
    });
    expect(result).toEqual(previewResult);
    expect(apiPost).toHaveBeenCalledWith(
      "/api/organizations/org-1/prompts/preview",
      { promptId: "prompt-1", variables: { doc: "some document text" } },
    );
  });
});
