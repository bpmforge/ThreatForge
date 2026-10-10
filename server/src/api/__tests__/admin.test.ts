/**
 * Admin API Tests - System Admin Protection
 *
 * Tests for Phase 0 of the organization system:
 * - System admin vs org admin separation
 * - Last system admin protection
 * - Super admin access controls
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
import { adminRoutes } from "../admin.js";

// Mock users
const mockSuperAdmin = {
  id: "super-admin-1",
  email: "super@example.com",
  name: "Super Admin",
};
const mockOrgAdmin = {
  id: "org-admin-1",
  email: "orgadmin@example.com",
  name: "Org Admin",
};
const mockRegularUser = {
  id: "user-1",
  email: "user@example.com",
  name: "Regular User",
};

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  membership: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  organization: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  project: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  threatModel: {
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  threat: {
    count: vi.fn(),
  },
  systemSettings: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
  auditLog: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

vi.mock("../../services/audit.js", () => ({
  queryAuditLogs: vi.fn(() => Promise.resolve({ logs: [], total: 0 })),
  purgeOldAuditLogs: vi.fn(() => Promise.resolve(0)),
}));

vi.mock("../../services/encryption/encryption-service.js", () => ({
  encryptValue: vi.fn((v) => v),
  decryptValue: vi.fn((v) => v),
}));

vi.mock("../../services/email/index.js", () => ({
  emailService: {
    testConnection: vi.fn(() => Promise.resolve({ success: true })),
    send: vi.fn(() => Promise.resolve({ success: true })),
    clearSettingsCache: vi.fn(),
  },
}));

describe("Admin API - System Admin Protection", () => {
  let app: FastifyInstance;
  let currentUser = mockSuperAdmin;

  beforeAll(async () => {
    app = Fastify();

    // Add hook to inject authUser
    app.addHook("preHandler", async (request) => {
      request.authUser = currentUser;
    });

    await app.register(adminRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = mockSuperAdmin;
  });

  describe("System Admin vs Org Admin Access", () => {
    it("allows super admin access to admin routes", async () => {
      currentUser = mockSuperAdmin;
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true });
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.organization.count.mockResolvedValue(1);
      mockPrisma.project.count.mockResolvedValue(1);
      mockPrisma.threatModel.count.mockResolvedValue(1);
      mockPrisma.threat.count.mockResolvedValue(1);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const response = await app.inject({
        method: "GET",
        url: "/api/admin/stats",
      });

      expect(response.statusCode).toBe(200);
    });

    it("denies org admin access to admin stats (SEC-002: super-admin only)", async () => {
      currentUser = mockOrgAdmin;
      // Not a super admin
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false });
      // Has OWNER role in an org — but admin stats require isSuperAdmin
      mockPrisma.membership.findFirst.mockResolvedValue({
        id: "m1",
        userId: mockOrgAdmin.id,
        role: "OWNER",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/admin/stats",
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body).error).toBe("Admin access required");
    });

    // Anyone can create an org and become its OWNER, so an org role must never
    // unlock instance-wide user management or audit logs.
    it.each([
      ["GET", "/api/admin/users"],
      ["GET", "/api/admin/users/victim-1"],
      ["PATCH", "/api/admin/users/victim-1"],
      ["DELETE", "/api/admin/users/victim-1"],
      ["GET", "/api/admin/audit"],
      ["GET", "/api/admin/audit/export"],
      ["POST", "/api/admin/audit/purge"],
    ] as const)(
      "denies org owner %s %s (super-admin only)",
      async (method, url) => {
        currentUser = mockOrgAdmin;
        mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false });
        mockPrisma.membership.findFirst.mockResolvedValue({
          id: "m1",
          userId: mockOrgAdmin.id,
          role: "OWNER",
        });

        const response = await app.inject({
          method,
          url,
          ...(method === "PATCH" ? { payload: { name: "x" } } : {}),
        });

        expect(response.statusCode).toBe(403);
        expect(mockPrisma.user.delete).not.toHaveBeenCalled();
        expect(mockPrisma.user.update).not.toHaveBeenCalled();
        expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
      },
    );

    it("denies regular user access to admin routes", async () => {
      currentUser = mockRegularUser;
      // Not a super admin
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false });
      // No admin membership
      mockPrisma.membership.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/admin/stats",
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body).error).toBe("Admin access required");
    });
  });

  describe("Super Admin Status Modification", () => {
    it("only super admins can modify super admin status", async () => {
      currentUser = mockOrgAdmin;
      // Org admin but not super admin
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false });
      mockPrisma.membership.findFirst.mockResolvedValue({
        id: "m1",
        userId: mockOrgAdmin.id,
        role: "OWNER",
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/admin/users/user-1",
        payload: { isSuperAdmin: true },
      });

      // Org admins are now stopped by the route-level super-admin gate.
      expect(response.statusCode).toBe(403);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("prevents self-demotion from super admin", async () => {
      currentUser = mockSuperAdmin;
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true });
      mockPrisma.membership.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/admin/users/${mockSuperAdmin.id}`,
        payload: { isSuperAdmin: false },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toBe(
        "Cannot demote yourself from super admin",
      );
    });
  });

  describe("Last System Admin Protection", () => {
    it("prevents demoting the last system admin via PATCH", async () => {
      currentUser = mockSuperAdmin;
      // Current user is super admin
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ isSuperAdmin: true }) // Check current user is super admin
        .mockResolvedValueOnce({ isSuperAdmin: true }); // Check target user is super admin

      // Only 1 super admin in system
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.membership.findFirst.mockResolvedValue(null);

      // Try to demote another super admin (simulating there's only one)
      const response = await app.inject({
        method: "PATCH",
        url: "/api/admin/users/other-admin-id",
        payload: { isSuperAdmin: false },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain(
        "Cannot demote the last system administrator",
      );
    });

    it("prevents demoting the last system admin via dedicated endpoint", async () => {
      currentUser = mockSuperAdmin;
      // Current user is super admin
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ isSuperAdmin: true }) // Check current user is super admin
        .mockResolvedValueOnce({ id: "target", isSuperAdmin: true }); // Target user exists and is admin

      // Only 1 super admin in system
      mockPrisma.user.count.mockResolvedValue(1);

      const response = await app.inject({
        method: "POST",
        url: "/api/admin/users/target-admin-id/super-admin",
        payload: { isSuperAdmin: false },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain(
        "Cannot demote the last system administrator",
      );
    });

    it("prevents deleting the last system admin", async () => {
      currentUser = mockSuperAdmin;
      // Current user is super admin
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ isSuperAdmin: true }) // Check current user is admin
        .mockResolvedValueOnce({ isSuperAdmin: true }); // Target user is super admin

      // Only 1 super admin in system
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.membership.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: "DELETE",
        url: "/api/admin/users/target-admin-id",
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain(
        "Cannot demote the last system administrator",
      );
    });

    it("allows demoting a super admin when others exist", async () => {
      currentUser = mockSuperAdmin;
      // Current user is super admin
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ isSuperAdmin: true }) // Check current user is super admin
        .mockResolvedValueOnce({ isSuperAdmin: true }); // Check target user is super admin

      // 2 super admins in system (safe to demote one)
      mockPrisma.user.count.mockResolvedValue(2);
      mockPrisma.membership.findFirst.mockResolvedValue(null);

      // Mock the update
      mockPrisma.user.update.mockResolvedValue({
        id: "target-admin-id",
        email: "target@example.com",
        name: "Target Admin",
        avatarUrl: null,
        isSuperAdmin: false,
        lastLoginAt: null,
        createdAt: new Date(),
        memberships: [],
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/admin/users/target-admin-id",
        payload: { isSuperAdmin: false },
      });

      expect(response.statusCode).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });
  });

  describe("User Self-Deletion Prevention", () => {
    it("prevents users from deleting themselves", async () => {
      currentUser = mockSuperAdmin;
      mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true });
      mockPrisma.membership.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: "DELETE",
        url: `/api/admin/users/${mockSuperAdmin.id}`,
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toBe("Cannot delete yourself");
    });
  });
});
