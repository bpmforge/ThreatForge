/**
 * Organization API Tests
 *
 * Tests for Phase 3 of the organization system:
 * - Create organization
 * - Update organization
 * - Delete organization (soft delete)
 * - Transfer ownership
 * - List organizations
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
import { organizationRoutes } from "../organizations.js";

// Mock users
const mockOwner = {
  id: "owner-1",
  email: "owner@example.com",
  name: "Org Owner",
};
const mockAdmin = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Org Admin",
};
const mockEditor = {
  id: "editor-1",
  email: "editor@example.com",
  name: "Org Editor",
};
const mockViewer = {
  id: "viewer-1",
  email: "viewer@example.com",
  name: "Org Viewer",
};

// Mock organization
const mockOrg = {
  id: "org-1",
  name: "Test Organization",
  slug: "test-org",
  description: "A test organization",
  type: "TEAM",
  isPersonal: false,
  ownerId: mockOwner.id,
  allowGuestAccess: true,
  guestDefaultRole: "VIEWER",
  allowGuestExport: false,
  settings: "{}",
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPersonalOrg = {
  ...mockOrg,
  id: "personal-org-1",
  name: "Owner's Workspace",
  slug: "owner-personal",
  type: "PERSONAL",
  isPersonal: true,
};

// Mock memberships
const mockMemberships = [
  {
    id: "m1",
    userId: mockOwner.id,
    organizationId: mockOrg.id,
    role: "OWNER",
    status: "ACTIVE",
  },
  {
    id: "m2",
    userId: mockAdmin.id,
    organizationId: mockOrg.id,
    role: "ADMIN",
    status: "ACTIVE",
  },
  {
    id: "m3",
    userId: mockEditor.id,
    organizationId: mockOrg.id,
    role: "EDITOR",
    status: "ACTIVE",
  },
  {
    id: "m4",
    userId: mockViewer.id,
    organizationId: mockOrg.id,
    role: "VIEWER",
    status: "ACTIVE",
  },
];

// Mock Prisma
const mockPrisma = {
  organization: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  membership: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  auditLog: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn((fn) => fn(mockPrisma)),
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

describe("Organization API", () => {
  let app: FastifyInstance;
  let currentUser = mockOwner;

  beforeAll(async () => {
    app = Fastify();

    // Add hook to inject authUser
    app.addHook("preHandler", async (request) => {
      request.authUser = currentUser;
    });

    await app.register(organizationRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = mockOwner;
  });

  describe("POST /api/organizations", () => {
    it("creates a new organization", async () => {
      currentUser = mockOwner;

      // Mock slug uniqueness check
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const newOrg = {
          id: "new-org-1",
          name: "New Organization",
          slug: "new-organization",
          description: "A new org",
          type: "TEAM",
          isPersonal: false,
          createdAt: new Date(),
        };
        mockPrisma.organization.create.mockResolvedValue(newOrg);
        mockPrisma.membership.create.mockResolvedValue({});
        mockPrisma.auditLog.create.mockResolvedValue({});
        return fn(mockPrisma);
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/organizations",
        payload: {
          name: "New Organization",
          description: "A new org",
          type: "TEAM",
        },
      });

      expect(response.statusCode).toBe(201);
      const _resp = JSON.parse(response.body);
      const body = _resp.data ?? _resp;
      expect(body.name).toBe("New Organization");
      expect(body.type).toBe("TEAM");
      expect(body.isPersonal).toBe(false);
    });

    it("validates organization name length", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/organizations",
        payload: {
          name: "A", // Too short
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toBe("Validation failed");
    });
  });

  describe("GET /api/organizations", () => {
    it("returns organizations user is member of", async () => {
      currentUser = mockOwner;

      mockPrisma.organization.findMany.mockResolvedValue([
        {
          ...mockOrg,
          memberships: [{ role: "OWNER", userId: mockOwner.id }],
        },
      ]);

      const response = await app.inject({
        method: "GET",
        url: "/api/organizations",
      });

      expect(response.statusCode).toBe(200);
      const _resp = JSON.parse(response.body);
      const body = _resp.data ?? _resp;
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe("Test Organization");
      expect(body[0].role).toBe("OWNER");
    });
  });

  describe("DELETE /api/organizations/:id", () => {
    it("allows owner to delete organization", async () => {
      currentUser = mockOwner;

      // Mock membership check - owner
      mockPrisma.membership.findUnique.mockResolvedValue({
        ...mockMemberships[0],
        role: "OWNER",
      });

      // Mock org fetch
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);

      const response = await app.inject({
        method: "DELETE",
        url: `/api/organizations/${mockOrg.id}`,
      });

      expect(response.statusCode).toBe(204);
    });

    it("prevents non-owner from deleting organization", async () => {
      currentUser = mockAdmin;

      // Mock membership check - admin
      mockPrisma.membership.findUnique.mockResolvedValue({
        ...mockMemberships[1],
        role: "ADMIN",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/organizations/${mockOrg.id}`,
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body).error).toContain("owner");
    });

    it("prevents deletion of personal organization", async () => {
      currentUser = mockOwner;

      // Mock membership check
      mockPrisma.membership.findUnique.mockResolvedValue({
        ...mockMemberships[0],
        role: "OWNER",
      });

      // Mock personal org fetch
      mockPrisma.organization.findUnique.mockResolvedValue(mockPersonalOrg);

      const response = await app.inject({
        method: "DELETE",
        url: `/api/organizations/${mockPersonalOrg.id}`,
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain(
        "Personal organizations cannot be deleted",
      );
    });
  });

  describe("POST /api/organizations/:id/transfer-ownership", () => {
    it("allows owner to transfer ownership", async () => {
      currentUser = mockOwner;

      // Mock membership checks
      mockPrisma.membership.findUnique.mockResolvedValueOnce({
        ...mockMemberships[0],
        role: "OWNER",
      }); // Current user role
      mockPrisma.membership.findFirst.mockResolvedValueOnce({
        ...mockMemberships[1],
        user: {
          id: mockAdmin.id,
          name: mockAdmin.name,
          email: mockAdmin.email,
        },
      }); // New owner's ACTIVE membership

      // Mock org fetch
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);

      const response = await app.inject({
        method: "POST",
        url: `/api/organizations/${mockOrg.id}/transfer-ownership`,
        payload: { newOwnerId: mockAdmin.id },
      });

      expect(response.statusCode).toBe(200);
      const _resp = JSON.parse(response.body);
      const body = _resp.data ?? _resp;
      expect(body.success).toBe(true);
      expect(body.newOwnerId).toBe(mockAdmin.id);
    });

    it("prevents non-owner from transferring ownership", async () => {
      currentUser = mockAdmin;

      // Mock membership check - admin
      mockPrisma.membership.findUnique.mockResolvedValue({
        ...mockMemberships[1],
        role: "ADMIN",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/organizations/${mockOrg.id}/transfer-ownership`,
        payload: { newOwnerId: mockEditor.id },
      });

      expect(response.statusCode).toBe(403);
    });

    it("prevents transferring personal organization ownership", async () => {
      currentUser = mockOwner;

      // Mock membership check
      mockPrisma.membership.findUnique.mockResolvedValueOnce({
        ...mockMemberships[0],
        role: "OWNER",
      });
      mockPrisma.membership.findFirst.mockResolvedValueOnce({
        ...mockMemberships[1],
        user: {
          id: mockAdmin.id,
          name: mockAdmin.name,
          email: mockAdmin.email,
        },
      });

      // Mock personal org fetch
      mockPrisma.organization.findUnique.mockResolvedValue(mockPersonalOrg);

      const response = await app.inject({
        method: "POST",
        url: `/api/organizations/${mockPersonalOrg.id}/transfer-ownership`,
        payload: { newOwnerId: mockAdmin.id },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain(
        "personal organization",
      );
    });

    it("prevents transferring to non-member", async () => {
      currentUser = mockOwner;

      // Mock membership checks
      mockPrisma.membership.findUnique.mockResolvedValueOnce({
        ...mockMemberships[0],
        role: "OWNER",
      });
      mockPrisma.membership.findFirst.mockResolvedValueOnce(null); // Non-member (or not ACTIVE)

      const response = await app.inject({
        method: "POST",
        url: `/api/organizations/${mockOrg.id}/transfer-ownership`,
        payload: { newOwnerId: "non-member-id" },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain("must be a member");
    });
  });

  describe("PATCH /api/organizations/:id", () => {
    it("prevents editor from updating organization", async () => {
      currentUser = mockEditor;

      // Mock membership check - editor (not admin or owner)
      mockPrisma.membership.findUnique.mockResolvedValue({
        ...mockMemberships[2],
        role: "EDITOR",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${mockOrg.id}`,
        payload: { name: "Updated Name" },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body).error).toContain(
        "Insufficient permissions",
      );
    });

    it("validates update payload", async () => {
      currentUser = mockOwner;

      // Mock membership check - owner
      mockPrisma.membership.findUnique.mockResolvedValue({
        ...mockMemberships[0],
        role: "OWNER",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${mockOrg.id}`,
        payload: { name: "A" }, // Too short
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toBe("Validation failed");
    });
  });

  // NOTE: Audit log tests moved to audit.test.ts
});
