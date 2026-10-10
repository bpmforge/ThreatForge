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
import rateLimit from "@fastify/rate-limit";

const mockPrisma = {
  threatModel: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn() },
  aIProvider: { aggregate: vi.fn() },
};
vi.mock("../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

const { aiGuarded } = await import("../guards.js");

describe("aiGuarded", () => {
  let app: FastifyInstance;
  const handler = vi.fn(async () => ({ ok: true }));

  beforeAll(async () => {
    app = Fastify();
    await app.register(rateLimit, { global: false });
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "u1", email: "a@x.test", name: "A" };
    });
    app.post(
      "/api/threat-models/:modelId/ai/x",
      aiGuarded({ model: "edit" }),
      handler,
    );
    await app.ready();
  });
  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.threatModel.findUnique.mockResolvedValue({
      project: { organizationId: "org1" },
    });
    mockPrisma.organization.findUnique.mockResolvedValue({
      monthlySpendCapUsd: null,
    });
    mockPrisma.aIProvider.aggregate.mockResolvedValue({
      _sum: { estimatedCost: 0 },
    });
  });

  const call = (modelId = "m1") =>
    app.inject({ method: "POST", url: `/api/threat-models/${modelId}/ai/x` });

  it("rejects with 429 AI_QUOTA_EXCEEDED once the org is over its cap", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      monthlySpendCapUsd: 10,
    });
    mockPrisma.aIProvider.aggregate.mockResolvedValue({
      _sum: { estimatedCost: 10 },
    });
    const res = await call();
    expect(res.statusCode).toBe(429);
    expect(res.json().code).toBe("AI_QUOTA_EXCEEDED");
    expect(handler).not.toHaveBeenCalled();
  });

  it("limits to 20 requests a minute per organization", async () => {
    mockPrisma.threatModel.findUnique.mockResolvedValue({
      project: { organizationId: "org-rate" },
    });
    for (let i = 0; i < 20; i++) expect((await call()).statusCode).toBe(200);
    expect((await call()).statusCode).toBe(429);
    // Another org has its own bucket.
    mockPrisma.threatModel.findUnique.mockResolvedValue({
      project: { organizationId: "org-other" },
    });
    expect((await call()).statusCode).toBe(200);
  });
});
