/**
 * AI-SPEND — every provider call is metered, the metered cost reaches the
 * AIProvider row the spend guard reads, and v2 handler stages report the
 * tokens their calls used.
 *
 * Before this fix aiMetrics.recordRequest had no callers, syncToDB never wrote
 * estimatedCost, and v2 stages hard-coded tokensUsed: 0 — so the spend cap
 * summed $0 forever.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const mockPrisma = {
  aIProvider: { findFirst: vi.fn(), update: vi.fn(), aggregate: vi.fn() },
  organization: { findUnique: vi.fn() },
  promptPipeline: { findUnique: vi.fn() },
  pipelineExecution: { create: vi.fn(), update: vi.fn() },
  pipelineStageExecution: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../prompt-service.js", () => ({ preparePrompt: vi.fn() }));
vi.mock("../stages/stage-cache.js", () => ({
  getCachedStage: vi.fn(async () => null),
  stageCacheKey: vi.fn(() => "stage-key"),
}));

/** A hosted provider that reports 1000 prompt + 500 completion tokens. */
const providerCalls = vi.fn();
vi.mock("../providers/claude.js", () => ({
  ClaudeClient: class {
    readonly provider = "claude" as const;
    async complete() {
      providerCalls();
      return {
        content: '{"ok":true}',
        usage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
        provider: "claude",
        model: "claude-sonnet-4-5-20250929",
      };
    }
    async isAvailable() {
      return true;
    }
  },
}));

import { createAIClient } from "../client-factory.js";
import { aiMetrics } from "../ai-metrics.js";
import { assertWithinSpendCap, SpendCapExceededError } from "../spend-guard.js";
import { executePipeline, clearPipelineCache } from "../pipeline-service.js";
import { registerStage, resetStageRegistry } from "../stages/registry.js";
import { priceFor, estimateCostUsd } from "../providers/pricing.js";
import type { AISettings } from "../../../types/settings.js";
import type { AIService } from "../ai-service.js";

const ORG = "org-spend";
const claudeSettings = {
  enabled: true,
  provider: "claude",
  apiKey: "test-key",
  model: "claude-sonnet-4-5",
} as AISettings;
/** Sonnet 4.5 list price: 1000 × $3/M + 500 × $15/M. */
const COST_PER_CALL = 0.0105;

function claudeClient() {
  const client = createAIClient(claudeSettings, ORG);
  if (!client) throw new Error("client not created");
  return client;
}

const req = { messages: [{ role: "user" as const, content: "hi" }] };

beforeEach(() => {
  vi.clearAllMocks();
  aiMetrics.reset();
});
afterAll(() => aiMetrics.stop());

describe("pricing", () => {
  it("self-hosted endpoints cost $0", () => {
    expect(priceFor("lmstudio", "qwen3", undefined).inputPerMillion).toBe(0);
    expect(
      priceFor("ollama", "llama3", "http://gpu.example.com").outputPerMillion,
    ).toBe(0);
    // OpenAI-compatible server on the LAN
    expect(
      priceFor("openai", "gpt-4o", "http://192.168.1.48:1234/v1")
        .inputPerMillion,
    ).toBe(0);
  });

  it("prices a dated hosted model id by its family row", () => {
    const p = priceFor("claude", "claude-sonnet-4-5-20250929", undefined);
    expect(estimateCostUsd(p, 1000, 500)).toBeCloseTo(COST_PER_CALL, 10);
  });

  it("prices another vendor's model served through an OpenAI-compatible proxy", () => {
    const p = priceFor(
      "openai",
      "anthropic/claude-sonnet-4-5",
      "https://openrouter.ai/api/v1",
    );
    expect(estimateCostUsd(p, 1000, 500)).toBeCloseTo(COST_PER_CALL, 10);
  });

  it("never prices an unknown hosted model at $0", () => {
    const p = priceFor("claude", "claude-unreleased-9", undefined);
    expect(p.inputPerMillion).toBeGreaterThan(0);
    expect(p.outputPerMillion).toBeGreaterThan(0);
  });
});

describe("provider calls are metered at the client factory", () => {
  it("records tokens and estimated cost for the org on every call", async () => {
    const client = claudeClient();
    await client.complete(req);
    await client.complete(req);

    const s = aiMetrics.getSummary(ORG);
    expect(s.totalRequests).toBe(2);
    expect(s.totalInputTokens).toBe(2000);
    expect(s.totalOutputTokens).toBe(1000);
    expect(s.totalTokens).toBe(3000);
    expect(s.estimatedCostUsd).toBeCloseTo(2 * COST_PER_CALL, 10);
  });

  it("records a failed call as an error with no cost", async () => {
    const client = claudeClient();
    // Simulate a provider failure through the real wrapper.
    providerCalls.mockImplementationOnce(() => {
      throw new Error("upstream 500");
    });
    await expect(client.complete(req)).rejects.toThrow("upstream 500");
    const s = aiMetrics.getSummary(ORG);
    expect(s.totalRequests).toBe(1);
    expect(s.errorRate).toBe(1);
    expect(s.estimatedCostUsd).toBe(0);
  });
});

describe("metered cost reaches the AIProvider row and the spend guard", () => {
  it("syncToDB increments estimatedCost on the org's default provider row", async () => {
    await claudeClient().complete(req);
    mockPrisma.aIProvider.findFirst.mockResolvedValue({
      id: "prov-1",
      usageResetAt: new Date(),
    });

    await aiMetrics.syncToDB();

    expect(mockPrisma.aIProvider.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG, isEnabled: true },
      }),
    );
    const { where, data } = mockPrisma.aIProvider.update.mock.calls[0][0];
    expect(where).toEqual({ id: "prov-1" });
    expect(data.totalTokens).toEqual({ increment: 1500 });
    expect(data.estimatedCost.increment).toBeCloseTo(COST_PER_CALL, 10);
    expect(aiMetrics.getPendingCostUsd(ORG)).toBe(0);
  });

  it("rolls the counters over when the row's usage is from a past month", async () => {
    await claudeClient().complete(req);
    mockPrisma.aIProvider.findFirst.mockResolvedValue({
      id: "prov-1",
      usageResetAt: new Date("2026-08-15T00:00:00Z"),
    });
    const now = new Date("2026-10-06T12:00:00Z");

    await aiMetrics.syncToDB(now);

    const { data } = mockPrisma.aIProvider.update.mock.calls[0][0];
    expect(data.totalTokens).toBe(1500);
    expect(data.estimatedCost).toBeCloseTo(COST_PER_CALL, 10);
    expect(data.usageResetAt).toEqual(now);
  });

  it("keeps usage pending when the org has no provider row to record against", async () => {
    await claudeClient().complete(req);
    mockPrisma.aIProvider.findFirst.mockResolvedValue(null);

    await aiMetrics.syncToDB();

    expect(mockPrisma.aIProvider.update).not.toHaveBeenCalled();
    expect(aiMetrics.getPendingCostUsd(ORG)).toBeCloseTo(COST_PER_CALL, 10);
  });

  it("spend guard blocks once synced spend reaches the cap", async () => {
    const client = claudeClient();
    for (let i = 0; i < 3; i++) await client.complete(req);
    mockPrisma.aIProvider.findFirst.mockResolvedValue({
      id: "prov-1",
      usageResetAt: new Date(),
    });
    await aiMetrics.syncToDB();
    const written = mockPrisma.aIProvider.update.mock.calls[0][0].data
      .estimatedCost.increment as number;

    mockPrisma.organization.findUnique.mockResolvedValue({
      monthlySpendCapUsd: 0.03,
    });
    mockPrisma.aIProvider.aggregate.mockResolvedValue({
      _sum: { estimatedCost: written },
    });

    await expect(
      assertWithinSpendCap(mockPrisma as never, ORG),
    ).rejects.toBeInstanceOf(SpendCapExceededError);
    // Only this month's rows count toward the cap.
    const aggWhere = mockPrisma.aIProvider.aggregate.mock.calls[0][0].where;
    expect(aggWhere.organizationId).toBe(ORG);
    expect(aggWhere.usageResetAt.gte).toBeInstanceOf(Date);
  });

  it("spend guard counts usage not yet synced", async () => {
    const client = claudeClient();
    for (let i = 0; i < 2; i++) await client.complete(req);
    mockPrisma.organization.findUnique.mockResolvedValue({
      monthlySpendCapUsd: 0.02,
    });
    mockPrisma.aIProvider.aggregate.mockResolvedValue({
      _sum: { estimatedCost: 0 },
    });

    await expect(
      assertWithinSpendCap(mockPrisma as never, ORG),
    ).rejects.toBeInstanceOf(SpendCapExceededError);
  });
});

describe("v2 handler stages report the tokens their calls used", () => {
  beforeEach(() => {
    clearPipelineCache();
    resetStageRegistry();
    mockPrisma.promptPipeline.findUnique.mockResolvedValue({
      id: "pipeline-v2",
      name: "v2",
      isActive: true,
      stopOnError: true,
      stages: [
        {
          id: "stage-ti",
          name: "ThreatIdentifier",
          order: 1,
          promptTemplateId: "handler:ThreatIdentifier",
          inputMapping: "{}",
          outputFields: "[]",
          condition: null,
          optional: false,
          retryCount: 0,
        },
      ],
    });
    mockPrisma.pipelineExecution.create.mockResolvedValue({
      id: "exec-1",
      status: "RUNNING",
    });
    mockPrisma.pipelineExecution.update.mockResolvedValue({});
    mockPrisma.pipelineStageExecution.create.mockResolvedValue({});
    mockPrisma.pipelineStageExecution.findFirst.mockResolvedValue({
      id: "stage-exec-1",
    });
    mockPrisma.pipelineStageExecution.update.mockResolvedValue({});
  });

  it("a stage that returns tokensUsed: 0 is credited with its calls' usage", async () => {
    // Mirrors the real v2 stages: two AICallFn calls, tokensUsed hard-coded 0.
    registerStage("ThreatIdentifier", async (ctx) => {
      await Promise.all([ctx.aiCall("sys", "a"), ctx.aiCall("sys", "b")]);
      return { outputs: { threats: [] }, tokensUsed: 0, parseFailures: [] };
    });
    const client = claudeClient();
    const aiCall = async (system: string, user: string) =>
      (
        await client.complete({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        })
      ).content;

    const result = await executePipeline(
      { pipelineId: "pipeline-v2", userId: "u", organizationId: ORG },
      {} as AIService,
      { aiCall },
    );

    expect(result.status).toBe("COMPLETED");
    expect(result.stageResults[0].tokensUsed).toBe(3000);
    expect(result.totalTokensUsed).toBe(3000);
    const updates = mockPrisma.pipelineStageExecution.update.mock.calls;
    expect(updates[updates.length - 1][0].data.tokensUsed).toBe(3000);
  });
});
