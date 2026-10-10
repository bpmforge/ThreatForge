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

// Mock user for testing
const mockUser = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
};

// Mock the database module
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
  user: {
    findFirst: vi.fn(),
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

describe("Threat Models API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();

    // Add a hook to inject authUser for all requests (simulating authenticated user)
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

  describe("GET /api/threat-models", () => {
    it("returns paginated list of threat models for authenticated user", async () => {
      const mockModels = [
        {
          id: "1",
          name: "Model 1",
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          project: { id: "p1", name: "Project 1" },
          threats: [],
        },
        {
          id: "2",
          name: "Model 2",
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          project: { id: "p1", name: "Project 1" },
          threats: [],
        },
      ];
      mockPrisma.threatModel.findMany.mockResolvedValue(mockModels);
      mockPrisma.threatModel.count.mockResolvedValue(2);

      const response = await app.inject({
        method: "GET",
        url: "/api/threat-models",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].name).toBe("Model 1");
      expect(body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });

      // Verify the query filters by user's organization membership
      expect(mockPrisma.threatModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            project: expect.objectContaining({
              organization: expect.objectContaining({
                memberships: expect.objectContaining({
                  some: { userId: mockUser.id, status: "ACTIVE" },
                }),
              }),
            }),
          }),
        }),
      );
    });

    it("returns empty data with pagination when no models exist", async () => {
      mockPrisma.threatModel.findMany.mockResolvedValue([]);
      mockPrisma.threatModel.count.mockResolvedValue(0);

      const response = await app.inject({
        method: "GET",
        url: "/api/threat-models",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(0);
      expect(body.pagination.total).toBe(0);
    });
  });

  describe("GET /api/threat-models/:id", () => {
    it("returns threat model when user has access", async () => {
      // Mock access check - user has membership
      mockPrisma.threatModel.findUnique
        .mockResolvedValueOnce({
          id: "1",
          project: {
            organizationId: "org-123",
            organization: {
              deletedAt: null,
              memberships: [{ role: "EDITOR" }],
            },
          },
        })
        .mockResolvedValueOnce({
          id: "1",
          name: "Test Model",
          version: 1,
          canvasState: JSON.stringify({ nodes: [], edges: [] }),
          components: [],
          connections: [],
          boundaries: [],
          threats: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      const response = await app.inject({
        method: "GET",
        url: "/api/threat-models/1",
      });

      expect(response.statusCode).toBe(200);
      const _resp = JSON.parse(response.body);
      const body = _resp.data ?? _resp;
      expect(body.name).toBe("Test Model");
      expect(body.canvasState).toEqual({ nodes: [], edges: [] });
    });

    it("returns 404 when user does not have access", async () => {
      // Mock access check - user has no membership
      mockPrisma.threatModel.findUnique.mockResolvedValue({
        id: "1",
        project: {
          organizationId: "org-123",
          organization: {
            deletedAt: null,
            memberships: [], // No membership for this user
          },
        },
      });
      // No guest access either
      mockPrisma.modelAccess.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/threat-models/1",
      });

      expect(response.statusCode).toBe(404);
      const _resp = JSON.parse(response.body);
      const body = _resp.data ?? _resp;
      expect(body.error).toBe("Threat model not found");
    });

    it("returns 404 when model not found", async () => {
      mockPrisma.threatModel.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/threat-models/nonexistent",
      });

      expect(response.statusCode).toBe(404);
      const _resp = JSON.parse(response.body);
      const body = _resp.data ?? _resp;
      expect(body.error).toBe("Threat model not found");
    });
  });

  describe("POST /api/threat-models", () => {
    beforeEach(() => {
      // Setup default mocks for creation flow
      mockPrisma.project.findFirst.mockResolvedValue({ id: "proj1" });
    });

    it("creates a new threat model", async () => {
      const mockCreated = {
        id: "new-id",
        name: "New Model",
        version: 1,
        canvasState: JSON.stringify({ nodes: [], edges: [] }),
        createdAt: new Date(),
        updatedAt: new Date(),
        project: { organizationId: "org-123" },
      };
      mockPrisma.threatModel.create.mockResolvedValue(mockCreated);

      const response = await app.inject({
        method: "POST",
        url: "/api/threat-models",
        payload: {
          name: "New Model",
          canvasState: { nodes: [], edges: [] },
        },
      });

      expect(response.statusCode).toBe(201);
      const _resp = JSON.parse(response.body);
      const body = _resp.data ?? _resp;
      expect(body.name).toBe("New Model");
      expect(body.canvasState).toEqual({ nodes: [], edges: [] });

      // Verify createdById is set to authenticated user
      expect(mockPrisma.threatModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdById: mockUser.id,
          }),
        }),
      );
    });

    it("returns 400 for invalid request body", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/threat-models",
        payload: {
          // Missing required 'name' field
          canvasState: { nodes: [], edges: [] },
        },
      });

      expect(response.statusCode).toBe(400);
      const _resp = JSON.parse(response.body);
      const body = _resp.data ?? _resp;
      expect(body.error).toBe("Validation failed");
    });

    it("returns 400 for empty name", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/threat-models",
        payload: {
          name: "",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("PATCH /api/threat-models/:id", () => {
    it("updates threat model when user has access", async () => {
      // Mock access check - user has membership (first findUnique call)
      // Then mock old data fetch (second findUnique call)
      mockPrisma.threatModel.findUnique
        .mockResolvedValueOnce({
          id: "1",
          project: {
            organizationId: "org-123",
            organization: {
              deletedAt: null,
              memberships: [{ role: "EDITOR" }],
            },
          },
        })
        .mockResolvedValueOnce({
          id: "1",
          name: "Old Name",
          project: { organizationId: "org-123" },
        });
      mockPrisma.threatModel.update.mockResolvedValue({
        id: "1",
        name: "Updated Name",
        version: 2,
        canvasState: JSON.stringify({ nodes: [], edges: [] }),
        project: { organizationId: "org-123" },
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/threat-models/1",
        payload: {
          name: "Updated Name",
        },
      });

      expect(response.statusCode).toBe(200);
      const _resp = JSON.parse(response.body);
      const body = _resp.data ?? _resp;
      expect(body.name).toBe("Updated Name");
    });

    it("returns 404 when user does not have access", async () => {
      mockPrisma.threatModel.findUnique.mockResolvedValue({
        id: "1",
        project: {
          organizationId: "org-123",
          organization: {
            deletedAt: null,
            memberships: [], // No membership
          },
        },
      });
      // No guest access either
      mockPrisma.modelAccess.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: "PATCH",
        url: "/api/threat-models/1",
        payload: {
          name: "Updated",
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/threat-models/:id", () => {
    it("deletes threat model when user has access", async () => {
      // First call: checkThreatModelAccess (via canPerformAction)
      // Second call: inside $transaction to get model name/org for audit log
      mockPrisma.threatModel.findUnique
        .mockResolvedValueOnce({
          id: "1",
          project: {
            organizationId: "org-123",
            organization: {
              deletedAt: null,
              memberships: [{ role: "OWNER" }],
            },
          },
        })
        .mockResolvedValueOnce({
          name: "Test Model",
          project: { organizationId: "org-123" },
        });
      mockPrisma.threatModel.delete.mockResolvedValue({ id: "1" });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const response = await app.inject({
        method: "DELETE",
        url: "/api/threat-models/1",
      });

      expect(response.statusCode).toBe(204);
      expect(mockPrisma.threatModel.delete).toHaveBeenCalledWith({
        where: { id: "1" },
      });
    });

    it("returns 404 when user does not have access", async () => {
      mockPrisma.threatModel.findUnique.mockResolvedValue({
        id: "1",
        project: {
          organizationId: "org-123",
          organization: {
            deletedAt: null,
            memberships: [], // No membership
          },
        },
      });
      // No guest access either
      mockPrisma.modelAccess.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: "DELETE",
        url: "/api/threat-models/1",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/threat-models/:id/save-canvas", () => {
    it("saves canvas state when user has access", async () => {
      mockPrisma.threatModel.findUnique.mockResolvedValue({
        id: "1",
        project: {
          organizationId: "org-123",
          organization: {
            deletedAt: null,
            memberships: [{ role: "EDITOR" }],
          },
        },
      });
      mockPrisma.threatModel.update.mockResolvedValue({ id: "1" });

      const response = await app.inject({
        method: "POST",
        url: "/api/threat-models/1/save-canvas",
        payload: {
          nodes: [{ id: "n1", position: { x: 0, y: 0 } }],
          edges: [],
        },
      });

      expect(response.statusCode).toBe(200);
      const _resp = JSON.parse(response.body);
      const body = _resp.data ?? _resp;
      expect(body.success).toBe(true);
    });

    it("returns 400 for invalid canvas state", async () => {
      // Mock for canPerformAction's checkThreatModelAccess
      mockPrisma.threatModel.findUnique.mockResolvedValue({
        id: "1",
        project: {
          organizationId: "org-1",
          organization: {
            deletedAt: null,
            memberships: [{ role: "EDITOR" }],
          },
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/threat-models/1/save-canvas",
        payload: {
          // Missing required 'nodes' and 'edges'
          invalid: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 404 when user does not have access", async () => {
      // Mock for canPerformAction's checkThreatModelAccess - no membership
      mockPrisma.threatModel.findUnique.mockResolvedValue({
        id: "1",
        project: {
          organizationId: "org-1",
          organization: {
            deletedAt: null,
            memberships: [], // No membership
          },
        },
      });
      // No guest access either
      mockPrisma.modelAccess.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: "/api/threat-models/1/save-canvas",
        payload: {
          nodes: [],
          edges: [],
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
