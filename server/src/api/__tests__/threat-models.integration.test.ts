/**
 * Threat Models Integration Tests
 *
 * Tests for threat model routes beyond basic CRUD:
 * - Stats endpoint
 * - Canvas save
 * - Access control patterns
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
import { threatModelRoutes } from "../threat-models.js";

const mockUser = { id: "user-1", email: "test@example.com", name: "Test User" };

const mockPrisma = {
  threatModel: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    delete: vi.fn(),
    count: vi.fn(),
  },
  project: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  organization: {
    create: vi.fn(),
  },
  membership: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  modelAccess: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  threat: {
    groupBy: vi.fn().mockResolvedValue([]),
  },
  auditLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn((cb: (tx: typeof mockPrisma) => Promise<unknown>) =>
    cb(mockPrisma),
  ),
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

// Mock canvas sync
vi.mock("../../services/canvas-sync.js", () => ({
  syncCanvasToDatabase: vi.fn(),
}));

// Mock audit
vi.mock("../../services/audit.js", () => ({
  logAudit: vi.fn(),
}));

describe("Threat Models Integration", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = mockUser;
    });
    await threatModelRoutes(app, {});
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/threat-models/:id/stats", () => {
    it("returns stats for accessible model", async () => {
      // Access check
      mockPrisma.threatModel.findUnique
        .mockResolvedValueOnce({
          id: "tm-1",
          project: {
            organizationId: "org-1",
            organization: {
              deletedAt: null,
              memberships: [{ role: "EDITOR" }],
            },
          },
        })
        .mockResolvedValueOnce({
          id: "tm-1",
          name: "Test Model",
          version: 1,
          updatedAt: new Date(),
          components: [
            { id: "c1", type: "PROCESS" },
            { id: "c2", type: "DATA_STORE" },
          ],
          connections: [{ id: "conn1" }],
          boundaries: [],
          threats: [
            {
              id: "t1",
              status: "OPEN",
              severity: "HIGH",
              strideCategories: '["SPOOFING"]',
              mitigations: [],
            },
            {
              id: "t2",
              status: "MITIGATED",
              severity: "MEDIUM",
              strideCategories: '["TAMPERING"]',
              mitigations: [{ id: "m1", status: "IMPLEMENTED" }],
            },
          ],
        });

      const response = await app.inject({
        method: "GET",
        url: "/api/threat-models/tm-1/stats",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const stats = body.data;
      expect(stats.totalThreats).toBe(2);
      expect(stats.openThreats).toBe(1);
      expect(stats.mitigatedThreats).toBe(1);
      expect(stats.componentCount).toBe(2);
      expect(stats.connectionCount).toBe(1);
      expect(stats.strideBreakdown).toHaveLength(6);
      expect(stats.totalMitigations).toBe(1);
      expect(stats.completedMitigations).toBe(1);
    });

    it("returns 404 when no access", async () => {
      mockPrisma.threatModel.findUnique.mockResolvedValue({
        id: "tm-1",
        project: {
          organizationId: "org-1",
          organization: { deletedAt: null, memberships: [] },
        },
      });
      mockPrisma.modelAccess.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/threat-models/tm-1/stats",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/threat-models/:id/save-canvas", () => {
    it("saves canvas when user has access", async () => {
      mockPrisma.threatModel.findUnique.mockResolvedValue({
        id: "tm-1",
        project: {
          organizationId: "org-1",
          organization: {
            deletedAt: null,
            memberships: [{ role: "EDITOR" }],
          },
        },
      });
      mockPrisma.threatModel.update.mockResolvedValue({ id: "tm-1" });

      const response = await app.inject({
        method: "POST",
        url: "/api/threat-models/tm-1/save-canvas",
        payload: {
          nodes: [{ id: "n1", position: { x: 10, y: 20 } }],
          edges: [{ id: "e1", source: "n1", target: "n2" }],
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe("GET /api/threat-models (list with search)", () => {
    it("filters by search query", async () => {
      mockPrisma.threatModel.findMany.mockResolvedValue([
        {
          id: "1",
          name: "Auth Model",
          version: 1,
          project: { id: "p1", name: "Project" },
        },
      ]);
      mockPrisma.threatModel.count.mockResolvedValue(1);
      mockPrisma.threat.groupBy.mockResolvedValue([
        {
          threatModelId: "1",
          status: "OPEN",
          severity: "HIGH",
          _count: { id: 1 },
        },
      ]);

      const response = await app.inject({
        method: "GET",
        url: "/api/threat-models?search=Auth",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe("Auth Model");
      expect(body.data[0].threatCount).toBe(1);
    });

    it("supports pagination params", async () => {
      mockPrisma.threatModel.findMany.mockResolvedValue([]);
      mockPrisma.threatModel.count.mockResolvedValue(50);

      const response = await app.inject({
        method: "GET",
        url: "/api/threat-models?page=3&limit=10",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.pagination.page).toBe(3);
      expect(body.pagination.limit).toBe(10);
      expect(body.pagination.total).toBe(50);
      expect(body.pagination.totalPages).toBe(5);
    });
  });
});
