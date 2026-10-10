/**
 * Super-admins enter the install's NVD API key in Admin > Settings. It is
 * stored encrypted, used for CVE lookups straight away, and never sent back
 * to the browser: the settings response only says whether a key is set and
 * where it comes from.
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
  row: {
    id: "default",
    aiPrivateHostAllowlist: null,
    aiAllowAllPrivateHosts: false,
    ipAllowlist: null,
    emailConfig: null,
    nvdApiKey: null as string | null,
    updatedAt: new Date(0),
  } as Record<string, unknown>,
}));

vi.mock("../../db.js", () => ({
  getPrisma: async () => ({
    user: { findUnique: async () => ({ isSuperAdmin: true }) },
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

const { settingsRoutes } = await import("../admin/settings-routes.js");
const { getNvdApiKey, clearNvdApiKeyCache } = await import(
  "../../services/nvd/nvd-api-key.js"
);

// Deliberately low-entropy so secret scanners do not flag it.
const KEY = "test-nvd-key-0000-0000-0000";

describe("admin settings: NVD API key", () => {
  let app: FastifyInstance;
  const savedEnv = process.env.NVD_API_KEY;

  beforeAll(async () => {
    delete process.env.NVD_API_KEY;
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "admin-1", email: "a@x.test" };
    });
    await app.register(settingsRoutes);
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    if (savedEnv !== undefined) process.env.NVD_API_KEY = savedEnv;
  });
  beforeEach(() => {
    state.row.nvdApiKey = null;
    clearNvdApiKeyCache();
  });

  const put = (body: Record<string, unknown>) =>
    app.inject({ method: "PUT", url: "/api/admin/settings", payload: body });

  it("stores the key encrypted, uses it, and never returns it", async () => {
    const res = await put({ nvdApiKey: KEY });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain(KEY);
    expect(res.json().data).toMatchObject({
      nvdApiKeyConfigured: true,
      nvdApiKeySource: "settings",
    });
    expect(state.row.nvdApiKey).not.toBe(KEY);
    expect(await getNvdApiKey()).toBe(KEY);

    const get = await app.inject({ method: "GET", url: "/api/admin/settings" });
    expect(get.body).not.toContain(KEY);
  });

  it("removes the key when sent empty", async () => {
    await put({ nvdApiKey: KEY });
    const res = await put({ nvdApiKey: "" });
    expect(state.row.nvdApiKey).toBeNull();
    expect(res.json().data.nvdApiKeyConfigured).toBe(false);
  });

  it("leaves the key alone when the field is omitted", async () => {
    await put({ nvdApiKey: KEY });
    await put({ allowSignups: true });
    clearNvdApiKeyCache();
    expect(await getNvdApiKey()).toBe(KEY);
  });

  it("rejects something that is not an NVD key", async () => {
    const res = await put({ nvdApiKey: "not a key!" });
    expect(res.statusCode).toBe(400);
  });
});
