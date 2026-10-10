import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const row = vi.hoisted(() => ({
  current: null as null | {
    aiPrivateHostAllowlist: string | null;
    aiAllowAllPrivateHosts: boolean;
  },
}));

vi.mock("../../../db.js", () => ({
  getPrisma: async () => ({
    systemSettings: { findFirst: async () => row.current },
  }),
}));

// 127.0.0.1 / 192.168.x resolve to themselves; no network.
vi.mock("node:dns/promises", async () => {
  const { isIP } = await import("node:net");
  return {
    lookup: vi.fn(async (host: string) => {
      if (isIP(host)) return [{ address: host, family: isIP(host) }];
      throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    }),
  };
});

const {
  getPrivateHostPolicy,
  checkTenantBaseUrl,
  assertAIEndpointAllowed,
  clearPrivateHostPolicyCache,
} = await import("../private-host-policy.js");

const ENV_KEYS = ["AI_PRIVATE_HOST_ALLOWLIST", "AI_ALLOW_ALL_PRIVATE_HOSTS"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  row.current = null;
  clearPrivateHostPolicyCache();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("private-host policy", () => {
  it("is closed by default", async () => {
    expect(await getPrivateHostPolicy()).toEqual({
      allowAll: false,
      entries: [],
    });
    expect(await checkTenantBaseUrl("http://127.0.0.1:8000")).not.toBeNull();
  });

  it("combines the super-admin list with AI_PRIVATE_HOST_ALLOWLIST", async () => {
    process.env.AI_PRIVATE_HOST_ALLOWLIST = "127.0.0.1, lmstudio.lan";
    row.current = {
      aiPrivateHostAllowlist: JSON.stringify(["192.168.50.0/24"]),
      aiAllowAllPrivateHosts: false,
    };
    const policy = await getPrivateHostPolicy();
    expect(policy.entries.sort()).toEqual(
      ["127.0.0.1", "192.168.50.0/24", "lmstudio.lan"].sort(),
    );
    expect(await checkTenantBaseUrl("http://127.0.0.1:8000")).toBeNull();
    expect(await checkTenantBaseUrl("http://192.168.50.20:1234")).toBeNull();
    expect(await checkTenantBaseUrl("http://10.0.0.5")).not.toBeNull();
  });

  it("drops invalid env entries instead of widening the list", async () => {
    process.env.AI_PRIVATE_HOST_ALLOWLIST =
      "169.254.169.254,0.0.0.0/0,10.1.2.3";
    expect((await getPrivateHostPolicy()).entries).toEqual(["10.1.2.3"]);
  });

  it("honours the allow-all switch from settings or env", async () => {
    row.current = {
      aiPrivateHostAllowlist: null,
      aiAllowAllPrivateHosts: true,
    };
    expect((await getPrivateHostPolicy()).allowAll).toBe(true);
    row.current = null;
    clearPrivateHostPolicyCache();
    process.env.AI_ALLOW_ALL_PRIVATE_HOSTS = "true";
    expect((await getPrivateHostPolicy()).allowAll).toBe(true);
  });

  it("re-reads settings after the cache is cleared", async () => {
    expect(await checkTenantBaseUrl("http://10.0.0.5")).not.toBeNull();
    row.current = {
      aiPrivateHostAllowlist: JSON.stringify(["10.0.0.5"]),
      aiAllowAllPrivateHosts: false,
    };
    clearPrivateHostPolicyCache();
    expect(await checkTenantBaseUrl("http://10.0.0.5")).toBeNull();
  });

  it("refuses a stored URL at call time", async () => {
    await expect(
      assertAIEndpointAllowed("http://192.168.1.10:8000/v1"),
    ).rejects.toThrow(/allowlist/);
    process.env.AI_PRIVATE_HOST_ALLOWLIST = "192.168.1.10";
    clearPrivateHostPolicyCache();
    await expect(
      assertAIEndpointAllowed("http://192.168.1.10:8000/v1"),
    ).resolves.toBeUndefined();
  });
});
