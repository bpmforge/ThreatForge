/**
 * Every provider surfaces a normalised finishReason so a reply cut off
 * at max tokens is distinguishable from a complete one.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { OpenAIClient } from "../providers/openai.js";
import { ClaudeClient } from "../providers/claude.js";
import { GeminiClient } from "../providers/gemini.js";
import { LMStudioClient } from "../providers/lmstudio.js";
import { OllamaClient } from "../providers/ollama.js";
import {
  normalizeFinishReason,
  warnIfTruncated,
} from "../providers/finish-reason.js";
import logger from "../../../utils/logger.js";

vi.mock("../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const msgs = [{ role: "user" as const, content: "x" }];

function stubJson(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => body }),
  );
}

describe("normalizeFinishReason", () => {
  it.each([
    ["stop", "stop"],
    ["end_turn", "stop"],
    ["STOP", "stop"],
    ["length", "length"],
    ["max_tokens", "length"],
    ["MAX_TOKENS", "length"],
    ["content_filter", "other"],
    ["SAFETY", "other"],
  ])("%s -> %s", (raw, expected) => {
    expect(normalizeFinishReason(raw)).toBe(expected);
  });

  it("returns undefined when the provider reported nothing", () => {
    expect(normalizeFinishReason(undefined)).toBeUndefined();
    expect(normalizeFinishReason(null)).toBeUndefined();
  });
});

describe("providers populate finishReason", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("openai: finish_reason length", async () => {
    stubJson({
      choices: [{ message: { content: "a" }, finish_reason: "length" }],
    });
    const r = await new OpenAIClient("k", "m", "http://x").complete({
      messages: msgs,
    });
    expect(r.finishReason).toBe("length");
  });

  it("lmstudio: finish_reason stop", async () => {
    stubJson({
      choices: [{ message: { content: "a" }, finish_reason: "stop" }],
    });
    const r = await new LMStudioClient("http://x", "m").complete({
      messages: msgs,
    });
    expect(r.finishReason).toBe("stop");
  });

  it("claude: stop_reason max_tokens", async () => {
    stubJson({
      content: [{ type: "text", text: "a" }],
      stop_reason: "max_tokens",
    });
    const r = await new ClaudeClient("k", "m", "http://x").complete({
      messages: msgs,
    });
    expect(r.finishReason).toBe("length");
  });

  it("gemini: finishReason MAX_TOKENS", async () => {
    stubJson({
      candidates: [
        { content: { parts: [{ text: "a" }] }, finishReason: "MAX_TOKENS" },
      ],
    });
    const r = await new GeminiClient("k", "m", "http://x").complete({
      messages: msgs,
    });
    expect(r.finishReason).toBe("length");
  });

  it("ollama: done_reason length", async () => {
    stubJson({ message: { content: "a" }, done_reason: "length" });
    const r = await new OllamaClient("m", "http://x").complete({
      messages: msgs,
    });
    expect(r.finishReason).toBe("length");
  });

  it("is undefined when the provider omits the field", async () => {
    stubJson({ choices: [{ message: { content: "a" } }] });
    const r = await new OpenAIClient("k", "m", "http://x").complete({
      messages: msgs,
    });
    expect(r.finishReason).toBeUndefined();
  });
});

describe("warnIfTruncated", () => {
  it("warns and returns true only on length", () => {
    const base = { provider: "openai" as const, model: "m" };
    expect(warnIfTruncated({ ...base, finishReason: "stop" })).toBe(false);
    expect(warnIfTruncated({ ...base })).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(
      warnIfTruncated({ ...base, finishReason: "length" }, "category"),
    ).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
