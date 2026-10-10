/**
 * The AI private-host allowlist is managed by platform super-admins through
 * the admin settings API, and a change takes effect immediately.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

const state = vi.hoisted(() => ({
  superAdmin: true,
  row: {
    id: "default",
    aiPrivateHostAllowlist: null as string | null,
    aiAllowAllPrivateHosts: false,
    ipAllowlist: null,
    emailConfig: null,
    updatedAt: new Date(0),
  } as Record<string, unknown>,
}));

vi.mock("../../db.js", () => ({
  getPrisma: async () => ({
    user: { findUnique: async () => ({ isSuperAdmin: state.superAdmin }) },
    systemSettings: {
      findFirst: async () => state.row,
      findUnique: async () => state.row,
      create: async () => state.row,
      upsert: async ({ update }: { update: Record<string, unknown> }) => {
        Object.assign(state.row, update);
        return state.row;
      },
    },
  }),
}));
vi.mock("node:dns/promises", async () => {
  const { isIP } = await import("node:net");
  return {
    lookup: vi.fn(async (host: string) => [
      { address: host, family: isIP(host) },
    ]),
  };
});

const { settingsRoutes } = await import("../admin/settings-routes.js");
const { checkTenantBaseUrl, clearPrivateHostPolicyCache } = await import(
  "../../services/ai/private-host-policy.js"
);

describe("admin settings: AI private-host allowlist", () => {
  let app: FastifyInstance;
  const savedEnv = process.env.AI_PRIVATE_HOST_ALLOWLIST;

  beforeAll(async () => {
    process.env.AI_PRIVATE_HOST_ALLOWLIST = "127.0.0.1";
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "admin-1", email: "admin@example.com" };
    });
    await app.register(settingsRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    if (savedEnv === undefined) delete process.env.AI_PRIVATE_HOST_ALLOWLIST;
    else process.env.AI_PRIVATE_HOST_ALLOWLIST = savedEnv;
  });

  beforeEach(() => {
    state.superAdmin = true;
    state.row.aiPrivateHostAllowlist = null;
    state.row.aiAllowAllPrivateHosts = false;
    clearPrivateHostPolicyCache();
  });

  const put = (payload: object) =>
    app.inject({ method: "PUT", url: "/api/admin/settings", payload });

  it("reports the stored list, the switch, and the environment's entries", async () => {
    state.row.aiPrivateHostAllowlist = JSON.stringify(["10.0.0.0/8"]);
    const res = await app.inject({ url: "/api/admin/settings" });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.aiPrivateHostAllowlist).toEqual(["10.0.0.0/8"]);
    expect(data.aiAllowAllPrivateHosts).toBe(false);
    expect(data.aiPrivateHostAllowlistFromEnv).toEqual(["127.0.0.1"]);
  });

  it("saves a valid list and applies it at once", async () => {
    expect(
      await checkTenantBaseUrl("http://192.168.50.20:1234"),
    ).not.toBeNull();
    const res = await put({
      aiPrivateHostAllowlist: [" 192.168.50.0/24 ", "lmstudio.lan"],
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(state.row.aiPrivateHostAllowlist as string)).toEqual([
      "192.168.50.0/24",
      "lmstudio.lan",
    ]);
    expect(res.json().data.aiPrivateHostAllowlist).toEqual([
      "192.168.50.0/24",
      "lmstudio.lan",
    ]);
    expect(await checkTenantBaseUrl("http://192.168.50.20:1234")).toBeNull();
  });

  it("rejects link-local, metadata and malformed entries", async () => {
    for (const entry of [
      "169.254.169.254",
      "0.0.0.0/0",
      "metadata.google.internal",
      "http://x",
    ]) {
      const res = await put({ aiPrivateHostAllowlist: [entry] });
      expect(res.statusCode, entry).toBe(400);
    }
    expect(state.row.aiPrivateHostAllowlist).toBeNull();
  });

  it("stores the allow-all switch", async () => {
    const res = await put({ aiAllowAllPrivateHosts: true });
    expect(res.statusCode).toBe(200);
    expect(state.row.aiAllowAllPrivateHosts).toBe(true);
    expect(await checkTenantBaseUrl("http://10.9.9.9")).toBeNull();
  });

  it("is super-admin only", async () => {
    state.superAdmin = false;
    const res = await put({ aiAllowAllPrivateHosts: true });
    expect(res.statusCode).toBe(403);
    expect(state.row.aiAllowAllPrivateHosts).toBe(false);
  });
});
