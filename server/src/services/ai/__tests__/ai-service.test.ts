/**
 * AI Service Unit Tests
 *
 * Tests for the AIService class:
 * - Availability check
 * - Completion
 * - Threat suggestion
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the client factory
const mockClient = {
  isAvailable: vi.fn(),
  complete: vi.fn(),
};

vi.mock("../client-factory.js", () => ({
  createAIClient: vi.fn(() => mockClient),
  supportsVision: vi.fn(() => false),
}));

// Mock prompts
vi.mock("../prompts.js", () => ({
  THREAT_ANALYSIS_SYSTEM_PROMPT: "Analyze threats",
  MITIGATION_SYSTEM_PROMPT: "Suggest mitigations",
  COMPONENT_THREAT_SYSTEM_PROMPT: "Component threats",
  SEVERITY_CALCULATION_SYSTEM_PROMPT: "Calculate severity",
  DIAGRAM_IMAGE_SYSTEM_PROMPT: "Analyze diagram",
  DIAGRAM_IMAGE_USER_PROMPT: "User diagram prompt",
  buildThreatAnalysisPrompt: vi.fn(() => "threat prompt"),
  buildMitigationPrompt: vi.fn(() => "mitigation prompt"),
  buildComponentThreatPrompt: vi.fn(() => "component prompt"),
  buildSeverityPrompt: vi.fn(() => "severity prompt"),
  buildChatSystemPrompt: vi.fn(() => "chat system"),
  buildExtractionPrompt: vi.fn(() => "extract prompt"),
  getExtractionSystemPrompt: vi.fn(() => "extract system"),
  detectDocumentType: vi.fn(() => "GENERAL"),
}));

// Mock response parsers
vi.mock("../response-parsers.js", () => ({
  parseThreatsFromResponse: vi.fn(() => []),
  parseMitigationsFromResponse: vi.fn(() => []),
  parseSeverityFromResponse: vi.fn(() => ({ severity: "MEDIUM", score: 5 })),
}));

// Mock db prompt executor
vi.mock("../db-prompt-executor.js", () => ({
  executePromptFromDB: vi.fn(),
  extractArchitectureWithDBPrompts: vi.fn(),
  suggestThreatsWithDBPrompts: vi.fn(),
  suggestMitigationsWithDBPrompts: vi.fn(),
}));

// Mock logger
vi.mock("../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { AIService } from "../ai-service.js";

const mockSettings = {
  enabled: true,
  provider: "openai" as const,
  apiKey: "test-key",
  model: "gpt-4",
  maxTokens: 4096,
  features: {
    autoSuggestThreats: true,
    autoSuggestMitigations: true,
    enableChat: true,
  },
  guardrails: {
    monthlyBudget: 0,
    anonymizeData: false,
    logInteractions: false,
  },
};

describe("AIService", () => {
  let service: AIService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AIService(mockSettings, "org-1");
  });

  describe("isAvailable", () => {
    it("returns true when client is available", async () => {
      mockClient.isAvailable.mockResolvedValue(true);
      expect(await service.isAvailable()).toBe(true);
    });

    it("returns false when client is unavailable", async () => {
      mockClient.isAvailable.mockResolvedValue(false);
      expect(await service.isAvailable()).toBe(false);
    });
  });

  describe("complete", () => {
    it("returns completion response", async () => {
      mockClient.complete.mockResolvedValue({
        content: "AI response",
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      });

      const result = await service.complete([
        { role: "user", content: "Hello" },
      ]);

      expect(result.content).toBe("AI response");
      expect(result.usage?.totalTokens).toBe(30);
      expect(mockClient.complete).toHaveBeenCalledWith({
        messages: [{ role: "user", content: "Hello" }],
      });
    });

    it("throws when client is null", async () => {
      const disabledService = new AIService(
        {
          ...mockSettings,
          enabled: false,
        },
        "org-1",
      );
      // Force client to null
      (disabledService as any).client = null;

      await expect(
        disabledService.complete([{ role: "user", content: "Hi" }]),
      ).rejects.toThrow("AI service not configured");
    });
  });

  describe("suggestThreats", () => {
    it("returns empty array when feature disabled", async () => {
      const noThreatService = new AIService(
        {
          ...mockSettings,
          features: { ...mockSettings.features, autoSuggestThreats: false },
        },
        "org-1",
      );

      const result = await noThreatService.suggestThreats({
        name: "tm",
        components: [],
        connections: [],
        boundaries: [],
      });

      expect(result).toEqual([]);
    });
  });
});
