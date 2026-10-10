/**
 * a local model server that answers HTTP 507 (insufficient memory)
 * releases that memory once it idles. Seed 11 lost every call after category
 * analysis to back-to-back 507s; a backoff-and-retry recovers. The retry runs
 * inside the in-flight slot so no queued caller reaches the server during the
 * idle window the retry is waiting for.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  AIProviderClient,
  AICompletionResponse,
} from "../../../types/ai.js";
import {
  INSUFFICIENT_MEMORY_BACKOFF_MS,
  isInsufficientMemoryError,
  retryOnInsufficientMemory,
} from "../providers/insufficient-memory-retry.js";
import {
  limitInflight,
  resetInflightLimiters,
} from "../providers/inflight-limiter.js";

const err507 = () =>
  new Error(
    'OpenAI API error: 507 - {"error":{"message":"insufficient memory: the request exceeded available GPU memory"}}',
  );
const ok: AICompletionResponse = {
  content: "ok",
  provider: "openai",
  model: "m",
};
const flush = () => new Promise((r) => setTimeout(r, 0));

/** A sleep that stays pending until the test resolves it. */
function manualSleep() {
  const pending: Array<{ ms: number; resolve: () => void }> = [];
  const sleep = vi.fn(
    (ms: number) =>
      new Promise<void>((resolve) => pending.push({ ms, resolve })),
  );
  return { sleep, pending, wake: () => pending.shift()?.resolve() };
}

beforeEach(() => resetInflightLimiters());

describe("isInsufficientMemoryError", () => {
  it("matches a provider 507 and nothing else", () => {
    expect(isInsufficientMemoryError(err507())).toBe(true);
    expect(
      isInsufficientMemoryError(new Error("LM Studio error: 507 - x")),
    ).toBe(true);
    expect(
      isInsufficientMemoryError(new Error("OpenAI API error: 500 - x")),
    ).toBe(false);
    expect(isInsufficientMemoryError(new Error("ECONNREFUSED"))).toBe(false);
  });
});

describe("retryOnInsufficientMemory", () => {
  it("retries a 507 after the first backoff and returns the retry's result", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(err507())
      .mockResolvedValue("done");
    const sleep = vi.fn(async (_ms: number, _signal?: AbortSignal) => {});

    await expect(retryOnInsufficientMemory(fn, { sleep })).resolves.toBe(
      "done",
    );
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(
      INSUFFICIENT_MEMORY_BACKOFF_MS[0],
      undefined,
    );
  });

  it("gives up after one retry per backoff step and rethrows the 507", async () => {
    const fn = vi.fn().mockRejectedValue(err507());
    const sleep = vi.fn(async (_ms: number, _signal?: AbortSignal) => {});

    await expect(retryOnInsufficientMemory(fn, { sleep })).rejects.toThrow(
      /507/,
    );
    expect(fn).toHaveBeenCalledTimes(INSUFFICIENT_MEMORY_BACKOFF_MS.length + 1);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual(
      INSUFFICIENT_MEMORY_BACKOFF_MS,
    );
  });

  it("does not retry other errors", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(new Error("OpenAI API error: 500 - x"));
    const sleep = vi.fn(async (_ms: number, _signal?: AbortSignal) => {});

    await expect(retryOnInsufficientMemory(fn, { sleep })).rejects.toThrow(
      /500/,
    );
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("rejects without another call when aborted during the backoff", async () => {
    const fn = vi.fn().mockRejectedValue(err507());
    const controller = new AbortController();

    const p = retryOnInsufficientMemory(fn, { signal: controller.signal });
    await flush();
    controller.abort(new Error("cancelled"));

    await expect(p).rejects.toThrow("cancelled");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("limitInflight + 507 retry", () => {
  it("holds the slot through the backoff so a queued caller waits", async () => {
    const complete = vi
      .fn<(o: unknown) => Promise<AICompletionResponse>>()
      .mockRejectedValueOnce(err507())
      .mockResolvedValue(ok);
    const client = {
      provider: "openai",
      complete,
    } as unknown as AIProviderClient;
    const { sleep, pending, wake } = manualSleep();
    const limited = limitInflight(
      client,
      "http://127.0.0.1:8000",
      {},
      { sleep },
    );
    const req = { messages: [{ role: "user" as const, content: "x" }] };

    const first = limited.complete(req);
    const second = limited.complete(req);
    await flush();

    expect(pending).toHaveLength(1); // first call is backing off
    expect(complete).toHaveBeenCalledTimes(1); // second has not reached the server

    wake();
    await expect(first).resolves.toEqual(ok);
    await expect(second).resolves.toEqual(ok);
    expect(complete).toHaveBeenCalledTimes(3);
  });
});
