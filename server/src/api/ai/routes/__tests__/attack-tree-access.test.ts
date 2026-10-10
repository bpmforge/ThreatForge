/**
 * The attack-tree `?async=true` branch created and enqueued an AiJob (billed
 * to the model's org) before the access check, which only guarded the sync
 * path. Any signed-in user could spend another org's AI budget and attach a
 * job to its model.
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

const mockCanAccess = vi.fn();
const mockPrisma = {
  threatModel: { findUnique: vi.fn() },
  aiJob: { create: vi.fn() },
};
const mockEnqueue = vi.fn();

// Role gating lives in ai-job-routes-edit-authz.test.ts; here access is
// all-or-nothing, answered by mockCanAccess(userId, modelId).
vi.mock("../../../threat-models/helpers.js", () => ({
  authorizeModelAction: async (
    reply: { status: (n: number) => { send: (b: unknown) => void } },
    userId: string,
    modelId: string,
  ) => {
    if (await mockCanAccess(userId, modelId)) return true;
    reply.status(404).send({ error: "Threat model not found" });
    return false;
  },
}));
vi.mock("../../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../../../services/ai/spend-guard.js", () => ({
  replyIfOverSpendCap: vi.fn().mockResolvedValue(false),
}));
vi.mock("../../../../jobs/ai-queue.js", () => ({
  enqueueAiJob: mockEnqueue,
}));
vi.mock("../../helpers.js", () => ({
  getAIServiceForModel: vi.fn().mockResolvedValue(null),
  buildThreatModelContext: vi.fn().mockResolvedValue(null),
  sendSuccess: (reply: { send: (b: unknown) => unknown }, data: unknown) =>
    reply.send({ data }),
  sendBadRequest: (
    reply: { status: (n: number) => { send: (b: unknown) => unknown } },
    msg: string,
  ) => reply.status(400).send({ error: msg }),
  sendInternalError: (
    reply: { status: (n: number) => { send: (b: unknown) => unknown } },
    msg: string,
  ) => reply.status(500).send({ error: msg }),
}));

const { attackTreeRoutes } = await import("../attack-tree.js");

describe("attack-tree async branch authorization", () => {
  let app: FastifyInstance;
  const savedRedis = process.env.REDIS_URL;

  beforeAll(async () => {
    process.env.REDIS_URL = "redis://test";
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "attacker", email: "a@x.test", name: "A" };
    });
    await app.register(attackTreeRoutes);
    await app.ready();
  });

  afterAll(async () => {
    if (savedRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = savedRedis;
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.threatModel.findUnique.mockResolvedValue({
      id: "victim",
      project: { organizationId: "victim-org" },
    });
    mockPrisma.aiJob.create.mockResolvedValue({ id: "job1" });
  });

  const post = (modelId: string) =>
    app.inject({
      method: "POST",
      url: `/api/threat-models/${modelId}/ai/attack-tree?async=true`,
      payload: { threatName: "SQL injection" },
    });

  it("refuses before creating or enqueuing a job", async () => {
    mockCanAccess.mockResolvedValue(false);

    const res = await post("victim");

    expect(res.statusCode).toBe(404);
    expect(mockCanAccess).toHaveBeenCalledWith("attacker", "victim");
    expect(mockPrisma.aiJob.create).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("queues the job when the caller can access the model", async () => {
    mockCanAccess.mockResolvedValue(true);

    const res = await post("m1");

    expect(res.statusCode).toBe(202);
    expect(mockPrisma.aiJob.create).toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalled();
  });
});
