/**
 * token accounting. The AICallFn the pipeline uses returns text only,
 * so usage has to be captured where that function is built, and the totals
 * have to reach the run summary.
 */
import { describe, it, expect, vi } from "vitest";
import type {
  AIProviderClient,
  AICompletionResponse,
  ThreatModelContext,
} from "../../../types/ai.js";
import { TokenMeter, meteredAiCall } from "../providers/token-meter.js";
import logger from "../../../utils/logger.js";
import { runMicroAnalysis } from "../micro-analysis/pipeline.js";

vi.mock("../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function fakeClient(responses: AICompletionResponse[]): AIProviderClient {
  const complete = vi.fn();
  for (const r of responses) complete.mockResolvedValueOnce(r);
  return {
    provider: "openai",
    complete,
    isAvailable: async () => true,
  } as unknown as AIProviderClient;
}

const reply = (
  content: string,
  usage?: AICompletionResponse["usage"],
): AICompletionResponse => ({ content, usage, provider: "openai", model: "m" });

describe("TokenMeter + meteredAiCall", () => {
  it("sums usage across calls and returns the text unchanged", async () => {
    const meter = new TokenMeter();
    const client = fakeClient([
      reply("a", { promptTokens: 100, completionTokens: 20, totalTokens: 120 }),
      reply("b", { promptTokens: 50, completionTokens: 5, totalTokens: 55 }),
    ]);
    const call = meteredAiCall(client, meter, {
      temperature: 0.3,
      maxTokens: 1000,
    });

    expect(await call("sys", "u1")).toBe("a");
    expect(await call("sys", "u2")).toBe("b");
    expect(meter.totals()).toEqual({
      calls: 2,
      callsWithoutUsage: 0,
      promptTokens: 150,
      completionTokens: 25,
      totalTokens: 175,
      maxPromptTokens: 100,
      truncatedCalls: 0,
    });
    expect(client.complete).toHaveBeenCalledWith({
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "u1" },
      ],
      temperature: 0.3,
      maxTokens: 1000,
    });
  });

  it("a named stage sends its generation-settings row; unstaged calls keep the defaults", async () => {
    const meter = new TokenMeter();
    const client = fakeClient([reply("a"), reply("b"), reply("c")]);
    const call = meteredAiCall(client, meter, {
      temperature: 0.3,
      maxTokens: 45000,
    });

    await call("sys", "u", "category");
    await call("sys", "u", "reviewer");
    await call("sys", "u");
    const sent = vi.mocked(client.complete).mock.calls.map(([o]) => ({
      maxTokens: o.maxTokens,
      thinking: o.thinking,
    }));
    expect(sent).toEqual([
      { maxTokens: 1500, thinking: false },
      { maxTokens: 16000, thinking: true },
      { maxTokens: 45000, thinking: undefined },
    ]);
  });

  it("counts replies that stopped at max tokens and warns", async () => {
    const meter = new TokenMeter();
    const client = fakeClient([
      { ...reply("partial"), finishReason: "length" },
      { ...reply("whole"), finishReason: "stop" },
      reply("unknown"),
    ]);
    const call = meteredAiCall(client, meter, {
      temperature: 0.3,
      maxTokens: 1000,
    });
    await call("s", "u");
    await call("s", "u");
    await call("s", "u");
    expect(meter.totals().truncatedCalls).toBe(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("a named stage's temperature wins over the caller default", async () => {
    const client = fakeClient([reply("a")]);
    const call = meteredAiCall(client, new TokenMeter(), {
      temperature: 0.9,
      maxTokens: 1000,
    });
    await call("s", "u", "mitigation");
    expect(client.complete).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.3 }),
    );
  });

  it("counts a response without usage as a call, not as zero tokens silently", async () => {
    const meter = new TokenMeter();
    const call = meteredAiCall(fakeClient([reply("x")]), meter, {
      temperature: 0.3,
      maxTokens: 10,
    });
    await call("s", "u");
    expect(meter.totals()).toMatchObject({ calls: 1, callsWithoutUsage: 1 });
  });

  it("totals() is a snapshot, not a live reference", () => {
    const meter = new TokenMeter();
    const snap = meter.totals();
    meter.record({ promptTokens: 1, completionTokens: 1, totalTokens: 2 });
    expect(snap.calls).toBe(0);
  });
});

describe("runMicroAnalysis summary.tokens", () => {
  const empty = {
    components: [],
    connections: [],
  } as unknown as ThreatModelContext;

  it("reports the meter totals when a meter is passed", async () => {
    const meter = new TokenMeter();
    meter.record({ promptTokens: 7, completionTokens: 3, totalTokens: 10 });
    const result = await runMicroAnalysis(empty, undefined, {
      tokenMeter: meter,
    });
    expect(result.summary.tokens).toEqual(meter.totals());
  });

  it("omits tokens when no meter is passed", async () => {
    const result = await runMicroAnalysis(empty, undefined, {});
    expect(result.summary.tokens).toBeUndefined();
  });
});
