/**
 * at most N completion requests in flight per provider endpoint.
 * Local model servers hold KV cache per in-flight request; unbounded fan-out
 * is what pushed MTPLX into HTTP 507 during recordings.
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type {
  AIProviderClient,
  AICompletionResponse,
} from "../../../types/ai.js";
import {
  inflightLimitFor,
  isLocalEndpoint,
  limitInflight,
  resetInflightLimiters,
} from "../providers/inflight-limiter.js";
import { createAIClient } from "../client-factory.js";

/** A client whose calls stay pending until released, counting concurrency. */
function gatedClient(provider = "lmstudio") {
  let active = 0;
  let peak = 0;
  const gates: Array<() => void> = [];
  const client = {
    provider,
    extra: () => "passthrough",
    isAvailable: async () => true,
    complete: vi.fn(async (): Promise<AICompletionResponse> => {
      active++;
      peak = Math.max(peak, active);
      await new Promise<void>((r) => gates.push(r));
      active--;
      return { content: "ok", provider: "lmstudio", model: "m" };
    }),
  } as unknown as AIProviderClient & { extra: () => string };
  return {
    client,
    peak: () => peak,
    started: () => gates.length,
    releaseOne: () => gates.shift()?.(),
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const req = { messages: [{ role: "user" as const, content: "x" }] };

beforeEach(() => resetInflightLimiters());

describe("inflightLimitFor", () => {
  it("defaults local endpoints to 1 and hosted APIs to unbounded", () => {
    expect(inflightLimitFor("lmstudio", undefined, {})).toBe(1);
    expect(inflightLimitFor("openai", "http://127.0.0.1:8000", {})).toBe(1);
    expect(inflightLimitFor("openai", undefined, {})).toBeNull();
    expect(
      inflightLimitFor("claude", "https://api.anthropic.com", {}),
    ).toBeNull();
  });

  it("honours MAX_INFLIGHT_PER_PROVIDER, 0 meaning off", () => {
    const env = { MAX_INFLIGHT_PER_PROVIDER: "3" };
    expect(inflightLimitFor("openai", undefined, env)).toBe(3);
    expect(
      inflightLimitFor("lmstudio", undefined, {
        MAX_INFLIGHT_PER_PROVIDER: "0",
      }),
    ).toBeNull();
  });

  it("classifies private and loopback hosts as local", () => {
    for (const u of [
      "http://localhost:1234/v1",
      "http://192.168.1.5:1234",
      "http://10.0.0.2",
      "http://172.20.0.1",
      "http://lmstudio-host.internal:1234/v1",
      "http://mac.local:8000",
    ])
      expect(isLocalEndpoint(u)).toBe(true);
    expect(isLocalEndpoint("https://api.openai.com")).toBe(false);
    expect(isLocalEndpoint("http://172.32.0.1")).toBe(false);
  });
});

describe("limitInflight", () => {
  it("never runs more than one call at a time against a local endpoint", async () => {
    const g = gatedClient();
    const limited = limitInflight(g.client, undefined, {});
    const all = Promise.all([1, 2, 3].map(() => limited.complete(req)));
    await flush();
    expect(g.started()).toBe(1);
    for (let i = 0; i < 3; i++) {
      g.releaseOne();
      await flush();
    }
    await all;
    expect(g.peak()).toBe(1);
    expect(g.client.complete).toHaveBeenCalledTimes(3);
  });

  it("shares one budget across clients for the same endpoint", async () => {
    const a = gatedClient();
    const b = gatedClient();
    const la = limitInflight(a.client, "http://127.0.0.1:8000", {});
    const lb = limitInflight(b.client, "http://127.0.0.1:8000", {});
    const pa = la.complete(req);
    const pb = lb.complete(req);
    await flush();
    expect(a.started() + b.started()).toBe(1);
    a.releaseOne();
    await flush();
    b.releaseOne();
    await Promise.all([pa, pb]);
  });

  it("releases the slot when a call throws", async () => {
    const client = {
      provider: "lmstudio",
      isAvailable: async () => true,
      complete: vi
        .fn()
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce({ content: "ok" }),
    } as unknown as AIProviderClient;
    const limited = limitInflight(client, undefined, {});
    await expect(limited.complete(req)).rejects.toThrow("boom");
    await expect(limited.complete(req)).resolves.toMatchObject({
      content: "ok",
    });
  });

  it("an aborted waiter leaves the queue without taking a slot", async () => {
    const g = gatedClient();
    const limited = limitInflight(g.client, undefined, {});
    const first = limited.complete(req);
    const ac = new AbortController();
    const second = limited.complete({ ...req, signal: ac.signal });
    const third = limited.complete(req);
    await flush();
    ac.abort(new Error("cancelled"));
    await expect(second).rejects.toThrow("cancelled");
    g.releaseOne();
    await flush();
    expect(g.started()).toBe(1); // third is running, second never started
    g.releaseOne();
    await Promise.all([first, third]);
    expect(g.client.complete).toHaveBeenCalledTimes(2);
  });

  it("passes other members through and returns hosted clients unwrapped", () => {
    const g = gatedClient();
    const limited = limitInflight(g.client, undefined, {}) as typeof g.client;
    expect(limited.extra()).toBe("passthrough");
    expect(limited.provider).toBe("lmstudio");
    const hosted = gatedClient("claude");
    expect(limitInflight(hosted.client, undefined, {})).toBe(hosted.client);
  });
});

describe("createAIClient", () => {
  let server: Server;
  let baseUrl: string;
  let active = 0;
  let peak = 0;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      active++;
      peak = Math.max(peak, active);
      setTimeout(() => {
        active--;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
      }, 30);
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
    // The local model is on loopback, which the private-host policy must allow.
    process.env.AI_PRIVATE_HOST_ALLOWLIST = "127.0.0.1";
  });

  afterAll(async () => {
    delete process.env.AI_PRIVATE_HOST_ALLOWLIST;
    await new Promise<void>((r) => server.close(() => r()));
  });

  it("a local provider never has two requests open at the server", async () => {
    const client = createAIClient(
      {
        enabled: true,
        provider: "lmstudio",
        model: "m",
        baseUrl,
      } as never,
      "org-1",
    ) as AIProviderClient;
    const results = await Promise.all(
      [1, 2, 3].map(() => client.complete(req)),
    );
    expect(results.map((r) => r.content)).toEqual(["ok", "ok", "ok"]);
    expect(peak).toBe(1);
  });
});
