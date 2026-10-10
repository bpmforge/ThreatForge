/**
 * Pause / Resume Flow Tests
 *
 * Exercises:
 *   - POST /api/ai-jobs/:jobId/pause — writes PAUSED status, signals worker
 *   - POST /api/ai-jobs/:jobId/retry — accepts PAUSED as a resumable state
 *   - Status/ownership/404 guardrails
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
const mockComponentCount = vi.fn();

const mockPrisma = {
  organization: {
    findUnique: vi.fn().mockResolvedValue({ monthlySpendCapUsd: null }),
  },
  aiJob: {
    findUnique: mockAiJobFindUnique,
    update: mockAiJobUpdate,
  },
  component: {
    count: mockComponentCount,
  },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

const mockCancelJob = vi.fn();
vi.mock("../../jobs/ai-worker.js", () => ({
  cancelJob: mockCancelJob,
}));

vi.mock("../../jobs/ai-queue.js", () => ({
  enqueueAiJob: vi.fn().mockResolvedValue(undefined),
  runJobInBackground: vi.fn(),
}));

const mockCanPerformAction = vi.fn();
vi.mock("../../services/access-control/access-control-service.js", () => ({
  isActiveOrgMember: vi.fn(async () => true),
  canPerformAction: (...args: unknown[]) => mockCanPerformAction(...args),
}));

import { aiJobRoutes } from "../ai-jobs.js";

describe("AI Jobs — pause / resume flow", () => {
  let app: FastifyInstance;

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
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAiJobUpdate.mockResolvedValue({});
    mockCanPerformAction.mockResolvedValue({ allowed: true });
  });

  it("pause refuses an owner who lost edit access to the job's model", async () => {
    mockAiJobFindUnique.mockResolvedValue({
      id: "job-1",
      userId: mockUser.id,
      status: "PROCESSING",
      threatModelId: "model-1",
    });
    mockCanPerformAction.mockResolvedValue({ allowed: false });

    const res = await app.inject({
      method: "POST",
      url: "/api/ai-jobs/job-1/pause",
    });

    expect(res.statusCode).toBe(403);
    expect(mockCancelJob).not.toHaveBeenCalled();
    expect(mockAiJobUpdate).not.toHaveBeenCalled();
  });

  describe("POST /api/ai-jobs/:jobId/pause", () => {
    it("writes PAUSED and signals worker when job is PROCESSING", async () => {
      mockAiJobFindUnique.mockResolvedValue({
        id: "job-1",
        userId: mockUser.id,
        status: "PROCESSING",
        checkpoint: JSON.stringify({ completedComponentIds: ["c-1"] }),
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/ai-jobs/job-1/pause",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.status).toBe("PAUSED");
      expect(body.data.hasCheckpoint).toBe(true);
      expect(mockCancelJob).toHaveBeenCalledWith("job-1");
      expect(mockAiJobUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "job-1" },
          data: expect.objectContaining({
            status: "PAUSED",
            progressMessage: expect.stringContaining("checkpoint saved"),
          }),
        }),
      );
    });

    it("pauses with no-checkpoint warning when none exists yet", async () => {
      mockAiJobFindUnique.mockResolvedValue({
        id: "job-2",
        userId: mockUser.id,
        status: "PROCESSING",
        checkpoint: null,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/ai-jobs/job-2/pause",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.hasCheckpoint).toBe(false);
      expect(mockAiJobUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            progressMessage: expect.stringContaining("no checkpoint"),
          }),
        }),
      );
    });

    it("rejects pause on a QUEUED job (only PROCESSING is pausable)", async () => {
      mockAiJobFindUnique.mockResolvedValue({
        id: "job-3",
        userId: mockUser.id,
        status: "QUEUED",
        checkpoint: null,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/ai-jobs/job-3/pause",
      });

      expect(res.statusCode).toBe(400);
      expect(mockCancelJob).not.toHaveBeenCalled();
      expect(mockAiJobUpdate).not.toHaveBeenCalled();
    });

    it("returns 404 when the job does not exist", async () => {
      mockAiJobFindUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/ai-jobs/missing/pause",
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 403 when the job belongs to another user", async () => {
      mockAiJobFindUnique.mockResolvedValue({
        id: "job-4",
        userId: "someone-else",
        status: "PROCESSING",
        checkpoint: null,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/ai-jobs/job-4/pause",
      });

      expect(res.statusCode).toBe(403);
      expect(mockCancelJob).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/ai-jobs/:jobId/retry — accepts PAUSED", () => {
    it("resumes a PAUSED job (checkpoint still valid)", async () => {
      mockAiJobFindUnique.mockResolvedValue({
        id: "job-5",
        userId: mockUser.id,
        status: "PAUSED",
        type: "SUGGEST_THREATS",
        organizationId: "org-1",
        threatModelId: "model-1",
        input: JSON.stringify({ mode: "micro" }),
        checkpoint: JSON.stringify({ completedComponentIds: ["c-1", "c-2"] }),
      });
      mockComponentCount.mockResolvedValue(2);

      const res = await app.inject({
        method: "POST",
        url: "/api/ai-jobs/job-5/retry",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.status).toBe("QUEUED");
      expect(body.data.mode).toBe("resume");
      expect(mockAiJobUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "QUEUED" }),
        }),
      );
    });

    it("rejects retry of a PROCESSING job (not a resumable state)", async () => {
      mockAiJobFindUnique.mockResolvedValue({
        id: "job-6",
        userId: mockUser.id,
        status: "PROCESSING",
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/ai-jobs/job-6/retry",
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toContain("PAUSED");
    });
  });
});
