/**
 * Without Redis, expert and agentic analysis used to run the whole multi-pass
 * AI analysis inside the HTTP request and skip the org's spend cap. They now
 * always check the cap and run as a tracked background job (BullMQ when
 * Redis is configured, the in-process runner otherwise).
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

const prisma = {
  threatModel: {
    findUnique: vi.fn(async () => ({ project: { organizationId: "org-1" } })),
  },
};
vi.mock("../../../../db.js", () => ({ getPrisma: vi.fn(async () => prisma) }));

const {
  mockSpend,
  mockCreateJob,
  mockRunInProcess,
  mockEnqueue,
  mockCreateClient,
} = vi.hoisted(() => ({
  mockSpend: vi.fn(async (..._args: unknown[]) => false),
  mockCreateJob: vi.fn(async () => ({
    conflict: false,
    job: { id: "job-1", threatModelId: "m1" },
  })),
  mockRunInProcess: vi.fn(),
  mockEnqueue: vi.fn(),
  mockCreateClient: vi.fn(),
}));
vi.mock("../../../../services/ai/spend-guard.js", () => ({
  replyIfOverSpendCap: mockSpend,
}));
vi.mock("../../../../jobs/create-suggest-threats-job.js", () => ({
  createSuggestThreatsJob: mockCreateJob,
}));
vi.mock("../../../../jobs/ai-queue.js", () => ({
  runJobInBackground: mockRunInProcess,
  enqueueAiJob: mockEnqueue,
}));
vi.mock("../../../../services/ai/client-factory.js", () => ({
  createAIClient: mockCreateClient,
}));
vi.mock("../../../threat-models/helpers.js", () => ({
  authorizeModelAction: vi.fn(async () => true),
}));
vi.mock("../../helpers.js", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  buildThreatModelContext: vi.fn(async () => ({
    components: [{ id: "c" }],
    connections: [],
  })),
}));

const { expertAnalysisRoutes } = await import("../expert-analysis.js");
const { agenticAnalysisRoutes } = await import("../agentic-analysis.js");

describe("AI analysis without Redis", () => {
  let app: FastifyInstance;
  const saved = process.env.REDIS_URL;
  beforeAll(async () => {
    delete process.env.REDIS_URL;
    app = Fastify();
    app.addHook("preHandler", async (r) => {
      r.authUser = { id: "u1", email: "u@x.test", name: "U" };
    });
    await app.register(expertAnalysisRoutes);
    await app.register(agenticAnalysisRoutes);
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    if (saved !== undefined) process.env.REDIS_URL = saved;
  });
  beforeEach(() => vi.clearAllMocks());

  it.each(["expert-analysis", "agentic-analysis"])(
    "%s checks the spend cap and starts a background job instead of running inline",
    async (route) => {
      const res = await app.inject({
        method: "POST",
        url: `/api/threat-models/m1/ai/${route}`,
        payload: {},
      });
      expect(res.statusCode).toBe(202);
      expect(res.json().data.jobId).toBe("job-1");
      expect(mockSpend).toHaveBeenCalledWith(
        expect.anything(),
        prisma,
        "org-1",
      );
      expect(mockRunInProcess).toHaveBeenCalledWith(
        expect.objectContaining({ type: "SUGGEST_THREATS", dbJobId: "job-1" }),
      );
      expect(mockCreateClient).not.toHaveBeenCalled();
    },
  );

  it("stops at the spend cap", async () => {
    mockSpend.mockImplementationOnce(async (...args: unknown[]) => {
      const reply = args[0] as {
        status: (n: number) => { send: (b: unknown) => unknown };
      };
      reply.status(429).send({ error: "cap" });
      return true;
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/threat-models/m1/ai/expert-analysis",
      payload: {},
    });
    expect(res.statusCode).toBe(429);
    expect(mockCreateJob).not.toHaveBeenCalled();
  });
});
