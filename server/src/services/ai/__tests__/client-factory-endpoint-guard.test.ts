/**
 * A stored AI base URL is checked again when the client is used: a URL saved
 * before the private-host allowlist existed, or whose host was removed from
 * it, is refused before any request leaves the server.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AIProviderClient } from "../../../types/ai.js";

const settings = vi.hoisted(() => ({ row: null as unknown }));
vi.mock("../../../db.js", () => ({
  getPrisma: async () => ({
    systemSettings: { findFirst: async () => settings.row },
  }),
}));
vi.mock("node:dns/promises", async () => {
  const { isIP } = await import("node:net");
  return {
    lookup: vi.fn(async (host: string) => {
      if (isIP(host)) return [{ address: host, family: isIP(host) }];
      throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    }),
  };
});

const { createAIClient } = await import("../client-factory.js");
const { clearPrivateHostPolicyCache } = await import(
  "../private-host-policy.js"
);

const lan = {
  enabled: true,
  provider: "lmstudio",
  baseUrl: "http://192.168.50.7:1234/v1",
  model: "local-model",
} as const;

describe("AI client endpoint guard", () => {
  const fetchSpy = vi.fn(async () =>
    Response.json({
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
  );

  beforeEach(() => {
    settings.row = null;
    clearPrivateHostPolicyCache();
    fetchSpy.mockClear();
    vi.stubGlobal("fetch", fetchSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refuses a completion to a private host that is not allowlisted", async () => {
    const client = createAIClient(lan as never, "org-1") as AIProviderClient;
    await expect(
      client.complete({
        messages: [{ role: "user", content: "hi" }],
      } as never),
    ).rejects.toThrow(/allowlist/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await client.isAvailable()).toBe(false);
  });

  it("lets the call through once the host is allowlisted", async () => {
    settings.row = {
      aiPrivateHostAllowlist: JSON.stringify(["192.168.50.0/24"]),
      aiAllowAllPrivateHosts: false,
    };
    const client = createAIClient(lan as never, "org-1") as AIProviderClient;
    await client
      .complete({ messages: [{ role: "user", content: "hi" }] } as never)
      .catch(() => undefined);
    expect(fetchSpy).toHaveBeenCalled();
  });
});
