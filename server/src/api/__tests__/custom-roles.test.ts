/**
 * Custom Roles API Tests
 *
 * Tests for custom role management:
 * - List roles
 * - Get role by ID
 * - Create role (admin only)
 * - Update role
 * - Delete role
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
import { customRoleRoutes } from "../custom-roles.js";

const mockUser = { id: "user-1", email: "test@example.com", name: "Test User" };

const mockPrisma = {
  customRole: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  membership: {
    findFirst: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

vi.mock("../../services/access-control/access-control-service.js", () => ({
  checkOrganizationAccess: vi.fn(),
}));

vi.mock("../../services/audit.js", () => ({
  logAudit: vi.fn(),
}));

import { checkOrganizationAccess } from "../../services/access-control/access-control-service.js";

const mockCheckAccess = checkOrganizationAccess as ReturnType<typeof vi.fn>;

describe("Custom Roles API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = mockUser;
    });
    await customRoleRoutes(app, {});
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/organizations/:orgId/roles", () => {
    it("lists custom roles for org member", async () => {
      mockCheckAccess.mockResolvedValue({
        hasAccess: true,
        role: "EDITOR",
        permissions: ["view"],
      });
      mockPrisma.customRole.findMany.mockResolvedValue([
        {
          id: "role-1",
          name: "Security Reviewer",
          description: "Can review threats",
          color: "#ff0000",
          permissions: '["MODEL_VIEW","THREAT_EDIT"]',
          isSystem: false,
          _count: { memberships: 3 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const response = await app.inject({
        method: "GET",
        url: "/api/organizations/org-1/roles",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe("Security Reviewer");
      expect(body[0].memberCount).toBe(3);
    });

    it("returns 403 when no access", async () => {
      mockCheckAccess.mockResolvedValue({ hasAccess: false, permissions: [] });

      const response = await app.inject({
        method: "GET",
        url: "/api/organizations/org-1/roles",
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("GET /api/organizations/:orgId/roles/:roleId", () => {
    it("returns role with members", async () => {
      mockCheckAccess.mockResolvedValue({
        hasAccess: true,
        role: "ADMIN",
        permissions: ["view", "manage"],
      });
      mockPrisma.customRole.findFirst.mockResolvedValue({
        id: "role-1",
        name: "Security Reviewer",
        description: "Review threats",
        color: "#ff0000",
        permissions: '["MODEL_VIEW"]',
        isSystem: false,
        memberships: [
          {
            id: "m-1",
            user: { id: "u-1", name: "Alice", email: "alice@test.com" },
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/organizations/org-1/roles/role-1",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("Security Reviewer");
      expect(body.members).toHaveLength(1);
    });

    it("returns 404 when role not found", async () => {
      mockCheckAccess.mockResolvedValue({
        hasAccess: true,
        role: "ADMIN",
        permissions: ["view", "manage"],
      });
      mockPrisma.customRole.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/organizations/org-1/roles/nonexistent",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/organizations/:orgId/roles", () => {
    it("creates a custom role", async () => {
      mockCheckAccess.mockResolvedValue({
        hasAccess: true,
        role: "OWNER",
        permissions: ["view", "manage", "admin"],
      });
      mockPrisma.customRole.findFirst.mockResolvedValue(null); // No duplicate
      mockPrisma.customRole.create.mockResolvedValue({
        id: "role-new",
        name: "Tester",
        description: "Test role",
        color: "#00ff00",
        createdAt: new Date(),
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/organizations/org-1/roles",
        payload: {
          name: "Tester",
          description: "Test role",
          color: "#00ff00",
          permissions: ["MODEL_VIEW", "THREAT_CREATE"],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("Tester");
    });

    it("returns 403 for non-admin", async () => {
      mockCheckAccess.mockResolvedValue({
        hasAccess: true,
        role: "EDITOR",
        permissions: ["view", "edit"],
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/organizations/org-1/roles",
        payload: {
          name: "Tester",
          permissions: ["MODEL_VIEW"],
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("returns 400 for duplicate name", async () => {
      mockCheckAccess.mockResolvedValue({
        hasAccess: true,
        role: "OWNER",
        permissions: ["view", "manage", "admin"],
      });
      mockPrisma.customRole.findFirst.mockResolvedValue({ id: "existing" });

      const response = await app.inject({
        method: "POST",
        url: "/api/organizations/org-1/roles",
        payload: {
          name: "Existing Role",
          permissions: ["MODEL_VIEW"],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 when no permissions provided", async () => {
      mockCheckAccess.mockResolvedValue({
        hasAccess: true,
        role: "OWNER",
        permissions: ["view", "manage", "admin"],
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/organizations/org-1/roles",
        payload: {
          name: "Empty Role",
          permissions: [],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
