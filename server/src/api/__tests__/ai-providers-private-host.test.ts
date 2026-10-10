/**
 * AI providers may only point at a loopback / private-network host that a
 * platform super-admin allowlisted, at save time and when a stored provider
 * is tested.
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

const mockPrisma = vi.hoisted(() => ({
  // findUnique: requireOrgRole (admin check); findFirst: legacy callers
  membership: { findFirst: vi.fn(), findUnique: vi.fn() },
  systemSettings: { findFirst: vi.fn() },
  aIProvider: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../db.js", () => ({ getPrisma: async () => mockPrisma }));
vi.mock("node:dns/promises", async () => {
  const { isIP } = await import("node:net");
  return {
    lookup: vi.fn(async (host: string) => {
      if (isIP(host)) return [{ address: host, family: isIP(host) }];
      throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    }),
  };
});

const { aiProviderRoutes } = await import("../ai-providers/index.js");
const { clearPrivateHostPolicyCache } = await import(
  "../../services/ai/private-host-policy.js"
);

const orgId = "org-1";

describe("AI providers and private hosts", () => {
  let app: FastifyInstance;
  const fetchSpy = vi.fn();

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "owner-1", email: "owner@example.com" };
    });
    await app.register(aiProviderRoutes);
    await app.ready();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clearPrivateHostPolicyCache();
    mockPrisma.membership.findFirst.mockResolvedValue({ id: "m1" });
    mockPrisma.membership.findUnique.mockResolvedValue({
      role: "OWNER",
      status: "ACTIVE",
    });
    mockPrisma.systemSettings.findFirst.mockResolvedValue(null);
    mockPrisma.aIProvider.aggregate.mockResolvedValue({
      _max: { priority: 0 },
    });
    mockPrisma.aIProvider.create.mockImplementation(async ({ data }) => ({
      id: "p1",
      ...data,
    }));
  });

  const create = (baseUrl: string) =>
    app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/ai-providers`,
      payload: { name: "LAN model", type: "LMSTUDIO", baseUrl },
    });

  it("refuses a private base URL that is not allowlisted", async () => {
    const res = await create("http://10.0.0.5:1234/v1");
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.aIProvider.create).not.toHaveBeenCalled();
  });

  it("accepts it once a super-admin lists the host", async () => {
    mockPrisma.systemSettings.findFirst.mockResolvedValue({
      aiPrivateHostAllowlist: JSON.stringify(["10.0.0.5"]),
      aiAllowAllPrivateHosts: false,
    });
    const res = await create("http://10.0.0.5:1234/v1");
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.aIProvider.create).toHaveBeenCalledTimes(1);
  });

  it("does not call a stored private URL when testing the provider", async () => {
    mockPrisma.aIProvider.findFirst.mockResolvedValue({
      id: "p1",
      type: "LMSTUDIO",
      baseUrl: "http://127.0.0.1:6379",
      encryptedApiKey: null,
      model: null,
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/ai-providers/p1/test`,
    });
    expect(res.json().data.success).toBe(false);
    expect(res.json().data.error).toMatch(/allowlist/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
