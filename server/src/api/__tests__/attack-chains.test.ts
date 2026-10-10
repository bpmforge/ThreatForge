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
import { attackChainRoutes } from "../attack-chains.js";

const mockUser = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
};

const MODEL_ID = "tm-1";

const mockHop = {
  id: "hop-1",
  chainId: "chain-1",
  position: 0,
  componentId: "comp-1",
  componentName: "API Gateway",
  connectionId: null,
  threatId: null,
  description: "Exploit SQL injection",
  technique: "T1190",
  isMitigated: false,
  mitigationIds: "[]",
  preconditions: '["network:public"]',
  yields: '["code-exec"]',
};

const mockChain = {
  id: "chain-1",
  threatModelId: MODEL_ID,
  name: "External API -> DB",
  description: "An attacker pivots from the public API to the DB.",
  severity: "HIGH",
  residualSeverity: null,
  likelihood: 0.6,
  status: "AI_SUGGESTED",
  sessionId: "sess-1",
  entryPointId: "comp-1",
  entryPointName: "API Gateway",
  targetAssetId: "comp-2",
  targetAssetName: "Payment DB",
  hops: [mockHop],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-02"),
};

const mockPrisma = {
  attackChain: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  threatModel: {
    findUnique: vi.fn(),
  },
  aiJob: {
    create: vi.fn(),
  },
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

describe("Attack Chains API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = mockUser as never;
    });
    await attackChainRoutes(app, {});
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCanAccess.mockResolvedValue(true);
  });

  // ==========================================================================
  // GET (list)
  // ==========================================================================
  describe("GET /api/threat-models/:id/attack-chains", () => {
    it("lists chains for a model the user can access", async () => {
      mockPrisma.attackChain.findMany.mockResolvedValue([mockChain]);

      const res = await app.inject({
        method: "GET",
        url: `/api/threat-models/${MODEL_ID}/attack-chains`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe("chain-1");
      expect(mockPrisma.attackChain.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { threatModelId: MODEL_ID } }),
      );
    });

    it("rejects access when the user cannot access the model", async () => {
      mockCanAccess.mockResolvedValue(false);

      const res = await app.inject({
        method: "GET",
        url: `/api/threat-models/${MODEL_ID}/attack-chains`,
      });

      expect(res.statusCode).toBe(404);
      expect(mockPrisma.attackChain.findMany).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GET (single)
  // ==========================================================================
  describe("GET /api/threat-models/:id/attack-chains/:chainId", () => {
    it("returns a single chain with ordered hops", async () => {
      mockPrisma.attackChain.findFirst.mockResolvedValue(mockChain);

      const res = await app.inject({
        method: "GET",
        url: `/api/threat-models/${MODEL_ID}/attack-chains/chain-1`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.hops[0].preconditions).toBe('["network:public"]');
    });

    it("404s when the chain does not belong to the model", async () => {
      mockPrisma.attackChain.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: `/api/threat-models/${MODEL_ID}/attack-chains/missing`,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ==========================================================================
  // POST (create)
  // ==========================================================================
  describe("POST /api/threat-models/:id/attack-chains", () => {
    const validBody = {
      name: "External API -> DB",
      description: "An attacker pivots from the public API to the DB.",
      severity: "HIGH",
      sessionId: "sess-1",
      entryPointId: "comp-1",
      entryPointName: "API Gateway",
      targetAssetId: "comp-2",
      targetAssetName: "Payment DB",
      hops: [
        {
          position: 0,
          componentId: "comp-1",
          componentName: "API Gateway",
          description: "Exploit SQL injection",
          preconditions: ["network:public"],
          yields: ["code-exec"],
        },
      ],
    };

    it("creates a chain and serializes capability tokens to JSON", async () => {
      mockPrisma.threatModel.findUnique.mockResolvedValue({ id: MODEL_ID });
      mockPrisma.attackChain.create.mockResolvedValue(mockChain);

      const res = await app.inject({
        method: "POST",
        url: `/api/threat-models/${MODEL_ID}/attack-chains`,
        payload: validBody,
      });

      expect(res.statusCode).toBe(201);
      const createArg = mockPrisma.attackChain.create.mock.calls[0][0];
      const hopData = createArg.data.hops.create[0];
      // String[] persisted as JSON-encoded strings for SQLite/Postgres parity.
      expect(hopData.preconditions).toBe('["network:public"]');
      expect(hopData.yields).toBe('["code-exec"]');
    });

    it("400s on an invalid payload (missing hops)", async () => {
      const { hops, ...noHops } = validBody;
      void hops;
      mockPrisma.threatModel.findUnique.mockResolvedValue({ id: MODEL_ID });

      const res = await app.inject({
        method: "POST",
        url: `/api/threat-models/${MODEL_ID}/attack-chains`,
        payload: noHops,
      });

      expect(res.statusCode).toBe(400);
      expect(mockPrisma.attackChain.create).not.toHaveBeenCalled();
    });

    it("rejects creation when access is denied", async () => {
      mockCanAccess.mockResolvedValue(false);

      const res = await app.inject({
        method: "POST",
        url: `/api/threat-models/${MODEL_ID}/attack-chains`,
        payload: validBody,
      });

      expect(res.statusCode).toBe(404);
      expect(mockPrisma.attackChain.create).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // PATCH (status)
  // ==========================================================================
  describe("PATCH /api/threat-models/:id/attack-chains/:chainId", () => {
    it("updates the status when valid", async () => {
      mockPrisma.attackChain.findFirst.mockResolvedValue(mockChain);
      mockPrisma.attackChain.update.mockResolvedValue({
        ...mockChain,
        status: "ACCEPTED",
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/threat-models/${MODEL_ID}/attack-chains/chain-1`,
        payload: { status: "ACCEPTED" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.status).toBe("ACCEPTED");
    });

    it("400s on an invalid status", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/threat-models/${MODEL_ID}/attack-chains/chain-1`,
        payload: { status: "BOGUS" },
      });

      expect(res.statusCode).toBe(400);
      expect(mockPrisma.attackChain.update).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // DELETE
  // ==========================================================================
  describe("DELETE /api/threat-models/:id/attack-chains/:chainId", () => {
    it("deletes an existing chain", async () => {
      mockPrisma.attackChain.findFirst.mockResolvedValue(mockChain);
      mockPrisma.attackChain.delete.mockResolvedValue(mockChain);

      const res = await app.inject({
        method: "DELETE",
        url: `/api/threat-models/${MODEL_ID}/attack-chains/chain-1`,
      });

      expect(res.statusCode).toBe(204);
      expect(mockPrisma.attackChain.delete).toHaveBeenCalledWith({
        where: { id: "chain-1" },
      });
    });

    it("rejects deletion when access is denied", async () => {
      mockCanAccess.mockResolvedValue(false);

      const res = await app.inject({
        method: "DELETE",
        url: `/api/threat-models/${MODEL_ID}/attack-chains/chain-1`,
      });

      expect(res.statusCode).toBe(404);
      expect(mockPrisma.attackChain.delete).not.toHaveBeenCalled();
    });
  });
});
