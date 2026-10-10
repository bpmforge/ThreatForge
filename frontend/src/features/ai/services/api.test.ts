/**
 * AI API Service Tests
 *
 * Tests for:
 * - checkAIAvailability: returns availability, handles request failure
 * - suggestThreats: unwraps threats array from response
 * - suggestMitigations: posts threat data, unwraps mitigations
 * - runMicroAnalysis: posts options, returns jobId/data
 * - chat: posts message+history
 * - refineThreat: posts to refine-threat endpoint, unwraps response
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkAIAvailability,
  suggestThreats,
  suggestMitigations,
  runMicroAnalysis,
  chat,
  refineThreat,
} from "./api";

// ---------------------------------------------------------------------------
// Mock api-client
// ---------------------------------------------------------------------------

vi.mock("@/lib/api-client", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

import { apiGet, apiPost } from "@/lib/api-client";

const mockGet = vi.mocked(apiGet);
const mockPost = vi.mocked(apiPost);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("checkAIAvailability", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns availability info when AI is configured", async () => {
    mockGet.mockResolvedValue({ data: { available: true } });
    const result = await checkAIAvailability("model-1");
    expect(result).toEqual({ available: true });
    expect(apiGet).toHaveBeenCalledWith(
      "/api/threat-models/model-1/ai/available",
    );
  });

  it("returns unavailable with reason when not configured", async () => {
    mockGet.mockResolvedValue({
      data: { available: false, reason: "No API key" },
    });
    const result = await checkAIAvailability("model-1");
    expect(result).toEqual({ available: false, reason: "No API key" });
  });

  it("returns { available: false } when request throws", async () => {
    mockGet.mockRejectedValue(new Error("Network error"));
    const result = await checkAIAvailability("model-1");
    expect(result).toEqual({ available: false, reason: "Request failed" });
  });
});

describe("suggestThreats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns threats array from response", async () => {
    const threats = [
      {
        title: "SQL Injection",
        description: "Input not sanitized",
        category: "TAMPERING",
        severity: "HIGH",
        confidence: 0.9,
      },
    ];
    mockPost.mockResolvedValue({ data: { threats } });
    const result = await suggestThreats("model-1");
    expect(result).toEqual(threats);
    expect(apiPost).toHaveBeenCalledWith(
      "/api/threat-models/model-1/ai/suggest-threats",
      {},
    );
  });

  it("returns empty array when threats is undefined", async () => {
    mockPost.mockResolvedValue({ data: {} });
    const result = await suggestThreats("model-1");
    expect(result).toEqual([]);
  });
});

describe("suggestMitigations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts threat data and returns mitigations", async () => {
    const mitigations = [
      {
        title: "Parameterized Queries",
        description: "Use prepared statements",
        category: "INPUT_VALIDATION",
        priority: "HIGH",
      },
    ];
    mockPost.mockResolvedValue({ data: { mitigations } });

    const threat = {
      title: "SQL Injection",
      description: "Input not sanitized",
      category: "TAMPERING",
    };
    const result = await suggestMitigations("model-1", threat);
    expect(result).toEqual(mitigations);
    expect(apiPost).toHaveBeenCalledWith(
      "/api/threat-models/model-1/ai/suggest-mitigations",
      threat,
    );
  });

  it("returns empty array when mitigations is missing", async () => {
    mockPost.mockResolvedValue({ data: {} });
    const result = await suggestMitigations("model-1", {
      title: "T",
      description: "D",
      category: "C",
    });
    expect(result).toEqual([]);
  });
});

describe("runMicroAnalysis", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts options and returns job response", async () => {
    const jobResponse = { jobId: "job-abc", data: null };
    mockPost.mockResolvedValue({ data: jobResponse });

    const result = await runMicroAnalysis("model-1", {
      methodologies: ["stride"],
      minConfidence: 0.7,
    });
    expect(result).toEqual(jobResponse);
    expect(apiPost).toHaveBeenCalledWith(
      "/api/threat-models/model-1/ai/micro-analysis",
      { methodologies: ["stride"], minConfidence: 0.7 },
    );
  });

  it("passes empty object when no options provided", async () => {
    mockPost.mockResolvedValue({ data: { jobId: "job-1" } });
    await runMicroAnalysis("model-1");
    expect(apiPost).toHaveBeenCalledWith(
      "/api/threat-models/model-1/ai/micro-analysis",
      {},
    );
  });
});

describe("chat", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts message and history, returns chat response", async () => {
    const chatResponse = {
      message: "Here is my analysis",
      usage: { tokens: 150 },
    };
    mockPost.mockResolvedValue(chatResponse);

    const history = [{ role: "user" as const, content: "Prior question" }];
    const result = await chat("model-1", "What are the risks?", history);

    expect(result).toEqual(chatResponse);
    expect(apiPost).toHaveBeenCalledWith("/api/threat-models/model-1/ai/chat", {
      message: "What are the risks?",
      history,
    });
  });

  it("uses empty history by default", async () => {
    mockPost.mockResolvedValue({ message: "OK", usage: {} });
    await chat("model-1", "Hello");
    expect(apiPost).toHaveBeenCalledWith("/api/threat-models/model-1/ai/chat", {
      message: "Hello",
      history: [],
    });
  });
});

describe("refineThreat", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts to refine-threat and unwraps response", async () => {
    const chatResponse = {
      message: "This threat is CRITICAL because...",
      usage: {},
    };
    mockPost.mockResolvedValue({ data: chatResponse });

    const history = [{ role: "user" as const, content: "Why critical?" }];
    const result = await refineThreat(
      "model-1",
      "threat-1",
      "Explain severity",
      history,
    );

    expect(result).toEqual(chatResponse);
    expect(apiPost).toHaveBeenCalledWith(
      "/api/threat-models/model-1/ai/refine-threat",
      { threatId: "threat-1", message: "Explain severity", history },
    );
  });

  it("uses empty history by default", async () => {
    mockPost.mockResolvedValue({ data: { message: "OK", usage: {} } });
    await refineThreat("model-1", "threat-1", "Refine");
    expect(apiPost).toHaveBeenCalledWith(
      "/api/threat-models/model-1/ai/refine-threat",
      { threatId: "threat-1", message: "Refine", history: [] },
    );
  });
});
