/**
 * Provider completion calls are bounded.
 *
 * The regression this guards is a provider that ACCEPTS the connection and then
 * never responds. That is not the same as a refused connection: `fetch` rejects
 * immediately on ECONNREFUSED, but waits forever on a silent socket, which is
 * how a dead local provider turned a 25-minute job into a 14.5-hour one.
 *
 * So these tests stand up a real HTTP server that accepts and never replies,
 * rather than mocking fetch — a mock cannot demonstrate the hang it is meant to
 * prevent.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  providerTimeoutMs,
  completionSignal,
  isAbortError,
  DEFAULT_PROVIDER_TIMEOUT_MS,
} from "../provider-timeout.js";
import { LMStudioClient } from "../providers/lmstudio.js";

/** A server that accepts the request and never answers. */
let blackHole: Server;
let baseUrl: string;

beforeAll(async () => {
  blackHole = createServer(() => {
    /* deliberately never responds */
  });
  await new Promise<void>((resolve) =>
    blackHole.listen(0, "127.0.0.1", resolve),
  );
  const { port } = blackHole.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/v1`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => blackHole.close(() => resolve()));
});

describe("providerTimeoutMs", () => {
  const original = process.env.AI_PROVIDER_TIMEOUT_MS;
  afterAll(() => {
    if (original === undefined) delete process.env.AI_PROVIDER_TIMEOUT_MS;
    else process.env.AI_PROVIDER_TIMEOUT_MS = original;
  });

  it("defaults when unset", () => {
    delete process.env.AI_PROVIDER_TIMEOUT_MS;
    expect(providerTimeoutMs()).toBe(DEFAULT_PROVIDER_TIMEOUT_MS);
  });

  it("clamps a value low enough to be effectively no timeout", () => {
    process.env.AI_PROVIDER_TIMEOUT_MS = "1";
    expect(providerTimeoutMs()).toBe(5_000);
  });

  it("clamps a value high enough to be effectively no timeout", () => {
    process.env.AI_PROVIDER_TIMEOUT_MS = "999999999";
    expect(providerTimeoutMs()).toBe(900_000);
  });

  it("falls back to the default on garbage rather than NaN", () => {
    process.env.AI_PROVIDER_TIMEOUT_MS = "soon";
    expect(providerTimeoutMs()).toBe(DEFAULT_PROVIDER_TIMEOUT_MS);
  });
});

describe("completionSignal", () => {
  it("aborts when the caller's signal aborts, before the timeout", async () => {
    const controller = new AbortController();
    const signal = completionSignal(controller.signal);
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(signal.aborted).toBe(true);
  });
});

describe("LM Studio completion against a server that never responds", () => {
  const original = process.env.AI_PROVIDER_TIMEOUT_MS;
  afterAll(() => {
    if (original === undefined) delete process.env.AI_PROVIDER_TIMEOUT_MS;
    else process.env.AI_PROVIDER_TIMEOUT_MS = original;
  });

  it("gives up instead of hanging, and does NOT burn its transient retries", async () => {
    // 5s is the clamp floor. Three transient retries would take >15s plus
    // 15s of backoff, so the elapsed assertion below distinguishes "aborted
    // once" from "aborted and then retried".
    process.env.AI_PROVIDER_TIMEOUT_MS = "5000";
    const client = new LMStudioClient(baseUrl, "test-model");

    const started = Date.now();
    const err = await client
      .complete({ messages: [{ role: "user", content: "hi" }] })
      .then(() => null)
      .catch((e: unknown) => e);
    const elapsed = Date.now() - started;

    expect(err).toBeInstanceOf(Error);
    expect(isAbortError(err)).toBe(true);
    // One timeout, not MAX_RETRIES of them.
    expect(elapsed).toBeLessThan(10_000);
  }, 30_000);
});
