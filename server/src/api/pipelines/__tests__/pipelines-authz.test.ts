/**
 * Pipeline routes authorization: org role per method, and every id in the URL
 * (pipeline, stage, execution) plus execute inputs must belong to :orgId.
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

const mockPrisma = {
  promptPipeline: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  pipelineStage: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  pipelineExecution: { findUnique: vi.fn() },
  document: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn() },
};
const requireOrgRole = vi.fn();
const checkThreatModelAccess = vi.fn();
const executePipeline = vi.fn();
const getPipelines = vi.fn();
const getExecutionStatus = vi.fn();

vi.mock("../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../../services/access-control/access-control-service.js", () => ({
  requireOrgRole: (...a: unknown[]) => requireOrgRole(...a),
  checkThreatModelAccess: (...a: unknown[]) => checkThreatModelAccess(...a),
}));
vi.mock("../../../services/ai/pipeline-service.js", () => ({
  getPipelineById: vi.fn(),
  getPipelines: (...a: unknown[]) => getPipelines(...a),
  executePipeline: (...a: unknown[]) => executePipeline(...a),
  getExecutionStatus: (...a: unknown[]) => getExecutionStatus(...a),
  getExecutionHistory: vi.fn(() =>
    Promise.resolve({ executions: [], total: 0 }),
  ),
  clearPipelineCache: vi.fn(),
}));
vi.mock("../../../services/ai/ai-service.js", () => ({ AIService: vi.fn() }));

const { pipelineRoutes } = await import("../index.js");

describe("pipeline routes authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "u1", email: "u1@x.test", name: "U1" };
    });
    await app.register(pipelineRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    requireOrgRole.mockResolvedValue({ allowed: true, role: "OWNER" });
    getPipelines.mockResolvedValue([]);
    mockPrisma.promptPipeline.findUnique.mockResolvedValue({
      organizationId: "org-a",
      isBuiltIn: false,
    });
  });

  it("rejects a non-member listing another org's pipelines", async () => {
    requireOrgRole.mockResolvedValue({ allowed: false, error: "Not a member" });

    const res = await app.inject({
      method: "GET",
      url: "/api/organizations/org-b/pipelines",
    });

    expect(res.statusCode).toBe(403);
    expect(getPipelines).not.toHaveBeenCalled();
  });

  it("requires ADMIN to change a pipeline and EDITOR to run one", async () => {
    await app.inject({
      method: "DELETE",
      url: "/api/organizations/org-a/pipelines/p1",
    });
    expect(requireOrgRole).toHaveBeenLastCalledWith("u1", "org-a", "ADMIN");

    await app.inject({
      method: "GET",
      url: "/api/organizations/org-a/pipelines",
    });
    expect(requireOrgRole).toHaveBeenLastCalledWith("u1", "org-a", "VIEWER");

    mockPrisma.organization.findUnique.mockResolvedValue(null);
    await app.inject({
      method: "POST",
      url: "/api/organizations/org-a/pipelines/p1/execute",
      payload: {},
    });
    expect(requireOrgRole).toHaveBeenLastCalledWith("u1", "org-a", "EDITOR");
  });

  it("returns 404 for a pipeline that belongs to another org", async () => {
    mockPrisma.promptPipeline.findUnique.mockResolvedValue({
      organizationId: "org-victim",
      isBuiltIn: false,
    });

    const res = await app.inject({
      method: "DELETE",
      url: "/api/organizations/org-a/pipelines/victim-pipeline",
    });

    expect(res.statusCode).toBe(404);
    expect(mockPrisma.promptPipeline.delete).not.toHaveBeenCalled();
  });

  it("returns 404 for a stage that is not in the pipeline in the URL", async () => {
    mockPrisma.pipelineStage.findUnique.mockResolvedValue({
      pipelineId: "victim-pipeline",
    });

    const res = await app.inject({
      method: "DELETE",
      url: "/api/organizations/org-a/pipelines/p1/stages/victim-stage",
    });

    expect(res.statusCode).toBe(404);
    expect(mockPrisma.pipelineStage.delete).not.toHaveBeenCalled();
  });

  it("returns 404 for another org's execution", async () => {
    getExecutionStatus.mockResolvedValue({
      execution: { id: "victim-exec" },
      stageExecutions: [],
    });
    mockPrisma.pipelineExecution.findUnique.mockResolvedValue({
      organizationId: "org-victim",
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/organizations/org-a/pipeline-executions/victim-exec",
    });

    expect(res.statusCode).toBe(404);
    expect(getExecutionStatus).not.toHaveBeenCalled();
  });

  it("refuses to execute over a document from another org", async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      threatModelId: "victim-model",
    });
    checkThreatModelAccess.mockResolvedValue({
      hasAccess: false,
      permissions: [],
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/organizations/org-a/pipelines/p1/execute",
      payload: { documentId: "victim-doc" },
    });

    expect(res.statusCode).toBe(404);
    expect(executePipeline).not.toHaveBeenCalled();
  });
});
