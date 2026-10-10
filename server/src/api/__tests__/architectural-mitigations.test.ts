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
import { architecturalMitigationRoutes } from "../architectural-mitigations.js";

const MODEL_ID = "tm-1";
const BASE = `/api/threat-models/${MODEL_ID}/architectural-mitigations`;

const row = {
  id: "am-1",
  threatModelId: MODEL_ID,
  kind: "ADD_WAF",
  title: "Add WAF",
  proposedChange: "Put a WAF in front of the API gateway",
  rationale: null,
  affectedComponentIds: '["c1"]',
  affectedConnectionIds: "[]",
  threatIds: '["t1","t2"]',
  attackChainIds: "[]",
  priority: "HIGH",
  status: "AI_SUGGESTED",
  source: "AI",
  sessionId: "s",
};

const mockPrisma = {
  architecturalMitigation: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  threatModel: { findUnique: vi.fn() },
  aiJob: { create: vi.fn(), findFirst: vi.fn() },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

const mockCanAccess = vi.fn();
// Role gating is covered by chain-archmit-authz.test.ts; here access is all-or-nothing.
vi.mock("../threat-models/helpers.js", () => ({
  authorizeModelAction: async (
    reply: { status: (n: number) => { send: (b: unknown) => void } },
    ...args: unknown[]
  ) => {
    if (await mockCanAccess(...args)) return true;
    reply.status(404).send({ error: "Threat model not found" });
    return false;
  },
}));

const mockSpendCap = vi.fn();
vi.mock("../../services/ai/spend-guard.js", async (orig) => ({
  ...(await orig<typeof import("../../services/ai/spend-guard.js")>()),
  assertWithinSpendCap: (...args: unknown[]) => mockSpendCap(...args),
}));

const mockRunInBackground = vi.fn();
vi.mock("../../jobs/ai-queue.js", () => ({
  enqueueAiJob: vi.fn(),
  runJobInBackground: (...args: unknown[]) => mockRunInBackground(...args),
}));

describe("Architectural Mitigations API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "user-123", email: "t@e.com" } as never;
    });
    await architecturalMitigationRoutes(app, {});
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanAccess.mockResolvedValue(true);
    mockSpendCap.mockResolvedValue(undefined);
    delete process.env.REDIS_URL;
  });

  it("lists rows with JSON arrays decoded", async () => {
    mockPrisma.architecturalMitigation.findMany.mockResolvedValue([row]);
    const res = await app.inject({ method: "GET", url: BASE });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data[0].threatIds).toEqual(["t1", "t2"]);
  });

  it("denies every route without model access", async () => {
    mockCanAccess.mockResolvedValue(false);
    for (const [method, url] of [
      ["GET", BASE],
      ["POST", `${BASE}/analyze`],
      ["PATCH", `${BASE}/am-1`],
      ["DELETE", `${BASE}/am-1`],
    ] as const) {
      const res = await app.inject({ method, url, payload: {} });
      expect(res.statusCode).toBe(404);
    }
    expect(mockPrisma.architecturalMitigation.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.aiJob.create).not.toHaveBeenCalled();
  });

  describe("analyze", () => {
    beforeEach(() => {
      mockPrisma.threatModel.findUnique.mockResolvedValue({
        id: MODEL_ID,
        project: { organizationId: "org-1" },
      });
      mockPrisma.aiJob.findFirst.mockResolvedValue(null);
      mockPrisma.aiJob.create.mockResolvedValue({ id: "job-1" });
    });

    it("creates an ARCHITECTURAL_MITIGATIONS job and runs it", async () => {
      const res = await app.inject({ method: "POST", url: `${BASE}/analyze` });
      expect(res.statusCode).toBe(202);
      expect(mockPrisma.aiJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: "ARCHITECTURAL_MITIGATIONS" }),
      });
      expect(mockSpendCap).toHaveBeenCalledWith(mockPrisma, "org-1");
      expect(mockRunInBackground).toHaveBeenCalledTimes(1);
    });

    it("returns 429 and creates no job when over the spend cap", async () => {
      const { SpendCapExceededError } = await import(
        "../../services/ai/spend-guard.js"
      );
      mockSpendCap.mockRejectedValue(new SpendCapExceededError(10, 11));
      const res = await app.inject({ method: "POST", url: `${BASE}/analyze` });
      expect(res.statusCode).toBe(429);
      expect(mockPrisma.aiJob.create).not.toHaveBeenCalled();
    });

    it("returns 409 when an analysis is already active", async () => {
      mockPrisma.aiJob.findFirst.mockResolvedValue({ id: "job-0" });
      const res = await app.inject({ method: "POST", url: `${BASE}/analyze` });
      expect(res.statusCode).toBe(409);
      expect(mockPrisma.aiJob.create).not.toHaveBeenCalled();
    });
  });

  describe("PATCH", () => {
    beforeEach(() => {
      mockPrisma.architecturalMitigation.findFirst.mockResolvedValue(row);
      mockPrisma.architecturalMitigation.update.mockImplementation(
        async ({ data }: { data: object }) => ({ ...row, ...data }),
      );
    });

    it("accept changes only status", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${BASE}/am-1`,
        payload: { status: "ACCEPTED" },
      });
      expect(res.statusCode).toBe(200);
      expect(
        mockPrisma.architecturalMitigation.update.mock.calls[0][0].data,
      ).toEqual({ status: "ACCEPTED" });
    });

    it("a content edit marks the row MODIFIED + HUMAN-owned", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${BASE}/am-1`,
        payload: { proposedChange: "Use a managed WAF with OWASP CRS" },
      });
      expect(res.statusCode).toBe(200);
      expect(
        mockPrisma.architecturalMitigation.update.mock.calls[0][0].data,
      ).toMatchObject({ status: "MODIFIED", source: "HUMAN" });
    });

    it("rejects an empty body and AI_SUGGESTED as a target status", async () => {
      for (const payload of [{}, { status: "AI_SUGGESTED" }]) {
        const res = await app.inject({
          method: "PATCH",
          url: `${BASE}/am-1`,
          payload,
        });
        expect(res.statusCode).toBe(400);
      }
    });

    it("404s for a row outside the model", async () => {
      mockPrisma.architecturalMitigation.findFirst.mockResolvedValue(null);
      const res = await app.inject({
        method: "PATCH",
        url: `${BASE}/other`,
        payload: { status: "REJECTED" },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  it("POST creates a HUMAN/MODIFIED row", async () => {
    mockPrisma.threatModel.findUnique.mockResolvedValue({ id: MODEL_ID });
    mockPrisma.architecturalMitigation.create.mockImplementation(
      async ({ data }: { data: object }) => ({ ...row, ...data }),
    );
    const res = await app.inject({
      method: "POST",
      url: BASE,
      payload: {
        kind: "ENCRYPT_CONNECTION",
        title: "TLS to DB",
        proposedChange: "Enable TLS on the app-to-db link",
        affectedConnectionIds: ["e1"],
      },
    });
    expect(res.statusCode).toBe(201);
    expect(
      mockPrisma.architecturalMitigation.create.mock.calls[0][0].data,
    ).toMatchObject({ source: "HUMAN", status: "MODIFIED" });
  });
});
