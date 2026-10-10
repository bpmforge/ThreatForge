/**
 * the OpenAI-compatible client sends `enable_thinking` only when the
 * caller asks for it, so servers without the extension see no new field.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { OpenAIClient } from "../providers/openai.js";

function stubFetch() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetchMock.mock.calls[0][1].body as string);
}

describe("OpenAIClient enable_thinking", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends enable_thinking:false when thinking is off", async () => {
    const fetchMock = stubFetch();
    const client = new OpenAIClient("key", "m", "http://127.0.0.1:1");
    await client.complete({
      messages: [{ role: "user", content: "x" }],
      thinking: false,
    });
    expect(sentBody(fetchMock).enable_thinking).toBe(false);
  });

  it("sends enable_thinking:true when thinking is on", async () => {
    const fetchMock = stubFetch();
    const client = new OpenAIClient("key", "m", "http://127.0.0.1:1");
    await client.complete({
      messages: [{ role: "user", content: "x" }],
      thinking: true,
    });
    expect(sentBody(fetchMock).enable_thinking).toBe(true);
  });

  it("omits the field when the caller does not set thinking", async () => {
    const fetchMock = stubFetch();
    const client = new OpenAIClient("key", "m", "http://127.0.0.1:1");
    await client.complete({ messages: [{ role: "user", content: "x" }] });
    expect("enable_thinking" in sentBody(fetchMock)).toBe(false);
  });
});
