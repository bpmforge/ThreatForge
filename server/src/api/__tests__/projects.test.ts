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
import { projectRoutes } from "../projects.js";

// Mock user for testing
const mockUser = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
};

// Mock fixtures
const mockOrg = { id: "org-1", name: "Test Org", slug: "test-org" };

const mockProject = {
  id: "proj-1",
  name: "Test Project",
  description: "A test project",
  status: "ACTIVE",
  organizationId: "org-1",
  createdById: "user-123",
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-02"),
  organization: mockOrg,
  createdBy: { id: "user-123", name: "Test User" },
  projectMembers: [{ id: "pm-1", userId: "user-123", role: "OWNER" }],
  threatModels: [],
  _count: { threatModels: 0 },
};

// Mock the database module
const mockPrisma = {
  project: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  membership: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  projectMember: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  threat: {
    groupBy: vi.fn(),
  },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

// Mock access control service
const mockCheckProjectAccess = vi.fn();
const mockCheckOrganizationAccess = vi.fn();

vi.mock("../../services/access-control/access-control-service.js", () => ({
  checkProjectAccess: (...args: unknown[]) => mockCheckProjectAccess(...args),
  checkOrganizationAccess: (...args: unknown[]) =>
    mockCheckOrganizationAccess(...args),
}));

describe("Projects API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();

    // Add a hook to inject authUser for all requests (simulating authenticated user)
    app.addHook("preHandler", async (request) => {
      request.authUser = mockUser;
    });

    await projectRoutes(app, {});
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // GET /api/projects
  // ==========================================================================
  describe("GET /api/projects", () => {
    it("returns paginated list of projects for authenticated user", async () => {
      const mockProjects = [
        { ...mockProject },
        {
          ...mockProject,
          id: "proj-2",
          name: "Second Project",
          _count: { threatModels: 3 },
        },
      ];
      mockPrisma.project.findMany.mockResolvedValue(mockProjects);
      mockPrisma.project.count.mockResolvedValue(2);

      const response = await app.inject({
        method: "GET",
        url: "/api/projects",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].name).toBe("Test Project");
      expect(body.data[1].name).toBe("Second Project");
      expect(body.data[1].threatModelCount).toBe(3);
      expect(body.pagination).toEqual(
        expect.objectContaining({
          page: 1,
          total: 2,
          hasNext: false,
          hasPrev: false,
        }),
      );

      // Verify the query filters by user's organization membership
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organization: expect.objectContaining({
              memberships: expect.objectContaining({
                some: { userId: mockUser.id, status: "ACTIVE" },
              }),
            }),
          }),
        }),
      );
    });

    it("returns empty data with pagination when no projects exist", async () => {
      mockPrisma.project.findMany.mockResolvedValue([]);
      mockPrisma.project.count.mockResolvedValue(0);

      const response = await app.inject({
        method: "GET",
        url: "/api/projects",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(0);
      expect(body.pagination.total).toBe(0);
    });

    it("supports search filter", async () => {
      mockPrisma.project.findMany.mockResolvedValue([]);
      mockPrisma.project.count.mockResolvedValue(0);

      await app.inject({
        method: "GET",
        url: "/api/projects?search=myproject",
      });

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: "myproject" },
          }),
        }),
      );
    });

    it("supports status filter", async () => {
      mockPrisma.project.findMany.mockResolvedValue([]);
      mockPrisma.project.count.mockResolvedValue(0);

      await app.inject({
        method: "GET",
        url: "/api/projects?status=ARCHIVED",
      });

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "ARCHIVED",
          }),
        }),
      );
    });

    it("supports pagination params", async () => {
      mockPrisma.project.findMany.mockResolvedValue([]);
      mockPrisma.project.count.mockResolvedValue(50);

      const response = await app.inject({
        method: "GET",
        url: "/api/projects?page=2&limit=10",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.pagination.page).toBe(2);
      expect(body.pagination.limit).toBe(10);
      expect(body.pagination.hasNext).toBe(true);
      expect(body.pagination.hasPrev).toBe(true);

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });
  });

  // ==========================================================================
  // GET /api/projects/:id
  // ==========================================================================
  describe("GET /api/projects/:id", () => {
    it("returns project with full details when user has access", async () => {
      mockCheckProjectAccess.mockResolvedValue({
        hasAccess: true,
        role: "OWNER",
        permissions: ["view", "edit", "delete", "manage", "admin", "export"],
        isGuest: false,
        organizationId: "org-1",
      });

      mockPrisma.project.findUnique.mockResolvedValue({
        ...mockProject,
        projectMembers: [{ id: "pm-1", userId: "user-123", role: "OWNER" }],
        threatModels: [
          {
            id: "tm-1",
            name: "Model 1",
            version: 1,
            updatedAt: new Date("2025-01-15"),
            _count: { threats: 5 },
          },
        ],
      });

      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          avatarUrl: null,
        },
      ]);

      mockPrisma.threat.groupBy.mockResolvedValue([
        { status: "OPEN", _count: 3 },
        { status: "MITIGATED", _count: 2 },
      ]);

      const response = await app.inject({
        method: "GET",
        url: "/api/projects/proj-1",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("Test Project");
      expect(body.organization).toEqual(mockOrg);
      expect(body.threatModels).toHaveLength(1);
      expect(body.threatModels[0].threatCount).toBe(5);
      expect(body.stats).toEqual({
        totalThreats: 5,
        openThreats: 3,
        mitigatedThreats: 2,
      });
    });

    it("returns 404 when user does not have access", async () => {
      mockCheckProjectAccess.mockResolvedValue({
        hasAccess: false,
        permissions: [],
        isGuest: false,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/projects/proj-999",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("NOT_FOUND");
    });

    it("returns 404 when project does not exist", async () => {
      mockCheckProjectAccess.mockResolvedValue({
        hasAccess: true,
        role: "OWNER",
        permissions: ["view"],
        isGuest: false,
      });
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/projects/nonexistent",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/projects
  // ==========================================================================
  describe("POST /api/projects", () => {
    it("creates a new project with explicit organizationId", async () => {
      mockCheckOrganizationAccess.mockResolvedValue({
        hasAccess: true,
        role: "OWNER",
        permissions: ["view", "edit", "delete", "manage", "admin"],
        isGuest: false,
        organizationId: "org-1",
      });

      mockPrisma.project.create.mockResolvedValue({
        ...mockProject,
        id: "proj-new",
        name: "New Project",
        description: "A new project",
        projectMembers: [],
        threatModels: [],
      });
      mockPrisma.projectMember.create.mockResolvedValue({
        id: "pm-new",
        projectId: "proj-new",
        userId: "user-123",
        role: "OWNER",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "New Project",
          description: "A new project",
          organizationId: "org-1",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe("New Project");

      // Verify creator is added as owner
      expect(mockPrisma.projectMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
            role: "OWNER",
          }),
        }),
      );
    });

    it("auto-selects organization when not provided", async () => {
      mockPrisma.membership.findMany.mockResolvedValue([
        { organizationId: "org-1", role: "EDITOR" },
      ]);
      mockCheckOrganizationAccess.mockResolvedValue({
        hasAccess: true,
        role: "EDITOR",
        permissions: ["view", "edit"],
        isGuest: false,
        organizationId: "org-1",
      });

      mockPrisma.project.create.mockResolvedValue({
        ...mockProject,
        id: "proj-auto",
        name: "Auto Org Project",
      });
      mockPrisma.projectMember.create.mockResolvedValue({});

      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Auto Org Project",
        },
      });

      expect(response.statusCode).toBe(201);
      // Verify project was created with the auto-selected org
      expect(mockPrisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: "org-1",
          }),
        }),
      );
    });

    it("returns 400 when user has no organization membership", async () => {
      mockPrisma.membership.findMany.mockResolvedValue([]);

      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Orphan Project",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("no organization membership");
    });

    it("returns 403 when user is not a member of specified organization", async () => {
      mockCheckOrganizationAccess.mockResolvedValue({
        hasAccess: false,
        permissions: [],
        isGuest: false,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Forbidden Project",
          organizationId: "org-other",
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("FORBIDDEN");
    });

    it("returns 422 for validation errors (name too short)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "AB", // min 3 characters
          organizationId: "org-1",
        },
      });

      expect(response.statusCode).toBe(422);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("returns 422 for missing name", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          organizationId: "org-1",
        },
      });

      expect(response.statusCode).toBe(422);
    });
  });

  // ==========================================================================
  // PATCH /api/projects/:id
  // ==========================================================================
  describe("PATCH /api/projects/:id", () => {
    it("updates project when user has access", async () => {
      mockCheckProjectAccess.mockResolvedValue({
        hasAccess: true,
        role: "OWNER",
        permissions: ["view", "edit", "delete", "manage", "admin"],
        isGuest: false,
        organizationId: "org-1",
      });

      mockPrisma.project.update.mockResolvedValue({
        ...mockProject,
        name: "Updated Project Name",
        threatModels: [],
        _count: { threatModels: 0 },
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/projects/proj-1",
        payload: {
          name: "Updated Project Name",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe("Updated Project Name");
    });

    it("returns 404 when user does not have access", async () => {
      mockCheckProjectAccess.mockResolvedValue({
        hasAccess: false,
        permissions: [],
        isGuest: false,
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/projects/proj-1",
        payload: {
          name: "Updated",
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("returns 422 for invalid update payload (name too short)", async () => {
      mockCheckProjectAccess.mockResolvedValue({
        hasAccess: true,
        role: "OWNER",
        permissions: ["view", "edit"],
        isGuest: false,
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/projects/proj-1",
        payload: {
          name: "AB", // min 3 characters
        },
      });

      expect(response.statusCode).toBe(422);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("can update project status to ARCHIVED", async () => {
      mockCheckProjectAccess.mockResolvedValue({
        hasAccess: true,
        role: "OWNER",
        permissions: ["view", "edit", "manage"],
        isGuest: false,
      });

      mockPrisma.project.update.mockResolvedValue({
        ...mockProject,
        status: "ARCHIVED",
        threatModels: [],
        _count: { threatModels: 0 },
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/projects/proj-1",
        payload: {
          status: "ARCHIVED",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).toBe("ARCHIVED");
    });
  });

  // ==========================================================================
  // DELETE /api/projects/:id
  // ==========================================================================
  describe("DELETE /api/projects/:id", () => {
    it("deletes project when user has delete permission", async () => {
      mockCheckProjectAccess.mockResolvedValue({
        hasAccess: true,
        role: "OWNER",
        permissions: ["view", "edit", "delete", "manage", "admin"],
        isGuest: false,
        organizationId: "org-1",
      });
      mockPrisma.project.delete.mockResolvedValue({ id: "proj-1" });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/projects/proj-1",
      });

      expect(response.statusCode).toBe(204);
      expect(mockPrisma.project.delete).toHaveBeenCalledWith({
        where: { id: "proj-1" },
      });
    });

    it("returns 404 when user does not have access", async () => {
      mockCheckProjectAccess.mockResolvedValue({
        hasAccess: false,
        permissions: [],
        isGuest: false,
      });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/projects/proj-999",
      });

      expect(response.statusCode).toBe(404);
    });

    it("returns 403 when user has access but no delete permission", async () => {
      mockCheckProjectAccess.mockResolvedValue({
        hasAccess: true,
        role: "VIEWER",
        permissions: ["view"],
        isGuest: false,
        organizationId: "org-1",
      });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/projects/proj-1",
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("FORBIDDEN");
    });

    it("returns 403 when user is EDITOR (no delete permission)", async () => {
      mockCheckProjectAccess.mockResolvedValue({
        hasAccess: true,
        role: "EDITOR",
        permissions: ["view", "comment", "edit", "export"],
        isGuest: false,
        organizationId: "org-1",
      });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/projects/proj-1",
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
