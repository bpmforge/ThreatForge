/**
 * POST /api/ai-jobs/:jobId/retry-failed route tests.
 *
 * Exercises the retry-failed surface (re-enqueue ONLY a partial run's
 * `result.failedUnits` on the SAME job id / sessionId):
 *   - COMPLETED + failedUnits → QUEUED, input gains exactly those retryUnits,
 *     checkpoint cleared, job re-enqueued
 *   - guardrails: non-SUGGEST_THREATS, non-COMPLETED, no failed units, 404, 403
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
import Fastify, { FastifyInstance } from "fastify";

const mockUser = { id: "user-1", email: "test@example.com", name: "Test" };

const mockAiJobFindUnique = vi.fn();
const mockAiJobUpdate = vi.fn();

const mockPrisma = {
  organization: {
    findUnique: vi.fn().mockResolvedValue({ monthlySpendCapUsd: null }),
  },
  aiJob: {
    findUnique: mockAiJobFindUnique,
    update: mockAiJobUpdate,
  },
  component: { count: vi.fn() },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

vi.mock("../../jobs/ai-worker.js", () => ({ cancelJob: vi.fn() }));

const mockEnqueueAiJob = vi.fn().mockResolvedValue(undefined);
const mockRunJobInBackground = vi.fn();
vi.mock("../../jobs/ai-queue.js", () => ({
  enqueueAiJob: (...args: unknown[]) => mockEnqueueAiJob(...args),
  runJobInBackground: (...args: unknown[]) => mockRunJobInBackground(...args),
}));

const mockIsActiveOrgMember = vi.fn();
const mockCanPerformAction = vi.fn();
vi.mock("../../services/access-control/access-control-service.js", () => ({
  isActiveOrgMember: (...args: unknown[]) => mockIsActiveOrgMember(...args),
  canPerformAction: (...args: unknown[]) => mockCanPerformAction(...args),
}));

import { aiJobRoutes } from "../ai-jobs.js";

const FAILED_UNITS = [
  { componentId: "comp-a", category: "SPOOFING", error: "boom" },
  { componentId: "comp-b", category: "TAMPERING", error: "boom" },
];

function completedPartialJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    userId: mockUser.id,
    type: "SUGGEST_THREATS",
    status: "COMPLETED",
    organizationId: "org-1",
    threatModelId: "model-1",
    input: JSON.stringify({ methodologies: ["stride"] }),
    result: JSON.stringify({ partial: true, failedUnits: FAILED_UNITS }),
    checkpoint: JSON.stringify({ completedComponentIds: ["comp-c"] }),
    ...overrides,
  };
}

describe("AI Jobs — retry-failed", () => {
  let app: FastifyInstance;
  const ORIGINAL_REDIS = process.env.REDIS_URL;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = mockUser;
    });
    await aiJobRoutes(app, {});
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    if (ORIGINAL_REDIS === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = ORIGINAL_REDIS;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAiJobUpdate.mockResolvedValue({});
    mockIsActiveOrgMember.mockResolvedValue(true);
    mockCanPerformAction.mockResolvedValue({ allowed: true });
    delete process.env.REDIS_URL;
  });

  it.each(["retry-failed", "retry"])(
    "%s refuses an owner who lost edit access to the job's model",
    async (action) => {
      mockAiJobFindUnique.mockResolvedValue(
        completedPartialJob(action === "retry" ? { status: "FAILED" } : {}),
      );
      mockCanPerformAction.mockResolvedValue({ allowed: false });

      const res = await app.inject({
        method: "POST",
        url: `/api/ai-jobs/job-1/${action}`,
      });

      expect(res.statusCode).toBe(403);
      expect(mockCanPerformAction).toHaveBeenCalledWith(
        mockUser.id,
        "model-1",
        "edit",
      );
      expect(mockAiJobUpdate).not.toHaveBeenCalled();
      expect(mockRunJobInBackground).not.toHaveBeenCalled();
    },
  );

  it.each(["retry-failed", "retry"])(
    "%s refuses a job owner who is no longer an ACTIVE member of the job's org",
    async (action) => {
      mockAiJobFindUnique.mockResolvedValue(
        completedPartialJob(action === "retry" ? { status: "FAILED" } : {}),
      );
      mockIsActiveOrgMember.mockResolvedValue(false);

      const res = await app.inject({
        method: "POST",
        url: `/api/ai-jobs/job-1/${action}`,
      });

      expect(res.statusCode).toBe(403);
      expect(mockIsActiveOrgMember).toHaveBeenCalledWith(mockUser.id, "org-1");
      expect(mockAiJobUpdate).not.toHaveBeenCalled();
      expect(mockRunJobInBackground).not.toHaveBeenCalled();
    },
  );

  it("re-enqueues ONLY the failed units on the same job id", async () => {
    mockAiJobFindUnique.mockResolvedValue(completedPartialJob());

    const res = await app.inject({
      method: "POST",
      url: "/api/ai-jobs/job-1/retry-failed",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe("QUEUED");
    expect(body.data.retriedUnits).toBe(2);

    // The update writes QUEUED, clears the checkpoint, and the input gains
    // EXACTLY the failed (componentId, category) pairs as retryUnits.
    const updateArg = mockAiJobUpdate.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: "job-1" });
    expect(updateArg.data.status).toBe("QUEUED");
    expect(updateArg.data.checkpoint).toBeNull();
    const newInput = JSON.parse(updateArg.data.input);
    expect(newInput.methodologies).toEqual(["stride"]);
    expect(newInput.retryUnits).toEqual([
      { componentId: "comp-a", category: "SPOOFING" },
      { componentId: "comp-b", category: "TAMPERING" },
    ]);

    // No Redis → runs in-process with the SAME dbJobId and the new input.
    expect(mockRunJobInBackground).toHaveBeenCalledTimes(1);
    const enqueued = mockRunJobInBackground.mock.calls[0][0];
    expect(enqueued.dbJobId).toBe("job-1");
    expect(JSON.parse(enqueued.input).retryUnits).toHaveLength(2);
  });

  it("enqueues via BullMQ when REDIS_URL is set", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    mockAiJobFindUnique.mockResolvedValue(completedPartialJob());

    const res = await app.inject({
      method: "POST",
      url: "/api/ai-jobs/job-1/retry-failed",
    });

    expect(res.statusCode).toBe(200);
    expect(mockEnqueueAiJob).toHaveBeenCalledTimes(1);
    expect(mockRunJobInBackground).not.toHaveBeenCalled();
  });

  it("rejects a job with no failed units", async () => {
    mockAiJobFindUnique.mockResolvedValue(
      completedPartialJob({
        result: JSON.stringify({ threats: [], summary: {} }),
      }),
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/ai-jobs/job-1/retry-failed",
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toContain("no failed units");
    expect(mockAiJobUpdate).not.toHaveBeenCalled();
  });

  it("rejects a non-COMPLETED job", async () => {
    mockAiJobFindUnique.mockResolvedValue(
      completedPartialJob({ status: "PROCESSING" }),
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/ai-jobs/job-1/retry-failed",
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toContain("COMPLETED");
  });

  it("rejects a non-SUGGEST_THREATS job", async () => {
    mockAiJobFindUnique.mockResolvedValue(
      completedPartialJob({ type: "EXPERT_ANALYSIS" }),
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/ai-jobs/job-1/retry-failed",
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toContain("SUGGEST_THREATS");
  });

  it("returns 404 when the job does not exist", async () => {
    mockAiJobFindUnique.mockResolvedValue(null);
    const res = await app.inject({
      method: "POST",
      url: "/api/ai-jobs/missing/retry-failed",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 403 when the job belongs to another user", async () => {
    mockAiJobFindUnique.mockResolvedValue(
      completedPartialJob({ userId: "someone-else" }),
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/ai-jobs/job-1/retry-failed",
    });
    expect(res.statusCode).toBe(403);
    expect(mockAiJobUpdate).not.toHaveBeenCalled();
  });
});
