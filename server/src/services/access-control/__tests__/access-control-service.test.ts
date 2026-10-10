/**
 * Access Control Service Tests
 *
 * Tests for the centralized access control system.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkOrganizationAccess,
  checkProjectAccess,
  checkThreatModelAccess,
  canPerformAction,
  requireOrgRole,
} from "../access-control-service.js";

// Mock users
const mockOwner = { id: "owner-1", email: "owner@example.com" };
const mockAdmin = { id: "admin-1", email: "admin@example.com" };
const mockEditor = { id: "editor-1", email: "editor@example.com" };
const mockViewer = { id: "viewer-1", email: "viewer@example.com" };
const mockGuest = { id: "guest-1", email: "guest@example.com" };

// Mock organization
const mockOrg = {
  id: "org-1",
  name: "Test Organization",
  deletedAt: null,
};

// Mock project
const mockProject = {
  id: "proj-1",
  organizationId: mockOrg.id,
  organization: mockOrg,
};

// Mock threat model
const mockThreatModel = {
  id: "tm-1",
  project: mockProject,
};

// Mock memberships
const mockMemberships = {
  owner: { userId: mockOwner.id, role: "OWNER", status: "ACTIVE" },
  admin: { userId: mockAdmin.id, role: "ADMIN", status: "ACTIVE" },
  editor: { userId: mockEditor.id, role: "EDITOR", status: "ACTIVE" },
  viewer: { userId: mockViewer.id, role: "VIEWER", status: "ACTIVE" },
};

// Mock guest access
const mockGuestAccess = {
  id: "access-1",
  userId: mockGuest.id,
  role: "VIEWER",
  canExport: false,
  expiresAt: null,
};

// Mock Prisma
const mockPrisma = {
  membership: {
    findUnique: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
  threatModel: {
    findUnique: vi.fn(),
  },
  modelAccess: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

describe("Access Control Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkOrganizationAccess", () => {
    it("returns access for active member", async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(
        mockMemberships.editor,
      );

      const result = await checkOrganizationAccess(mockEditor.id, mockOrg.id);

      expect(result.hasAccess).toBe(true);
      expect(result.role).toBe("EDITOR");
      expect(result.isGuest).toBe(false);
      expect(result.permissions).toContain("view");
      expect(result.permissions).toContain("edit");
    });

    it("denies access for non-member", async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(null);

      const result = await checkOrganizationAccess("stranger", mockOrg.id);

      expect(result.hasAccess).toBe(false);
      expect(result.permissions).toEqual([]);
    });

    it("denies access for inactive membership", async () => {
      mockPrisma.membership.findUnique.mockResolvedValue({
        ...mockMemberships.editor,
        status: "PENDING",
      });

      const result = await checkOrganizationAccess(mockEditor.id, mockOrg.id);

      expect(result.hasAccess).toBe(false);
    });
  });

  describe("checkProjectAccess", () => {
    it("returns access for org member", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        organizationId: mockOrg.id,
        organization: {
          deletedAt: null,
          memberships: [{ role: "ADMIN" }],
        },
      });

      const result = await checkProjectAccess(mockAdmin.id, mockProject.id);

      expect(result.hasAccess).toBe(true);
      expect(result.role).toBe("ADMIN");
      expect(result.permissions).toContain("manage");
    });

    it("denies access when organization is deleted", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        organizationId: mockOrg.id,
        organization: {
          deletedAt: new Date(),
          memberships: [{ role: "ADMIN" }],
        },
      });

      const result = await checkProjectAccess(mockAdmin.id, mockProject.id);

      expect(result.hasAccess).toBe(false);
    });
  });

  describe("checkThreatModelAccess", () => {
    it("returns member access with full permissions", async () => {
      mockPrisma.threatModel.findUnique.mockResolvedValue({
        id: mockThreatModel.id,
        project: {
          organizationId: mockOrg.id,
          organization: {
            deletedAt: null,
            memberships: [{ role: "OWNER" }],
          },
        },
      });

      const result = await checkThreatModelAccess(
        mockOwner.id,
        mockThreatModel.id,
      );

      expect(result.hasAccess).toBe(true);
      expect(result.role).toBe("OWNER");
      expect(result.isGuest).toBe(false);
      expect(result.permissions).toContain("admin");
      expect(result.permissions).toContain("delete");
    });

    it("returns guest access with limited permissions", async () => {
      // No membership
      mockPrisma.threatModel.findUnique.mockResolvedValue({
        id: mockThreatModel.id,
        project: {
          organizationId: mockOrg.id,
          organization: {
            deletedAt: null,
            memberships: [],
          },
        },
      });

      // Has guest access
      mockPrisma.modelAccess.findFirst.mockResolvedValue(mockGuestAccess);
      mockPrisma.modelAccess.update.mockResolvedValue({});

      const result = await checkThreatModelAccess(
        mockGuest.id,
        mockThreatModel.id,
      );

      expect(result.hasAccess).toBe(true);
      expect(result.role).toBe("VIEWER");
      expect(result.isGuest).toBe(true);
      expect(result.permissions).toContain("view");
      expect(result.permissions).not.toContain("edit");
    });

    it("denies access without membership or guest access", async () => {
      mockPrisma.threatModel.findUnique.mockResolvedValue({
        id: mockThreatModel.id,
        project: {
          organizationId: mockOrg.id,
          organization: {
            deletedAt: null,
            memberships: [],
          },
        },
      });
      mockPrisma.modelAccess.findFirst.mockResolvedValue(null);

      const result = await checkThreatModelAccess(
        "stranger",
        mockThreatModel.id,
      );

      expect(result.hasAccess).toBe(false);
    });
  });

  describe("canPerformAction", () => {
    it("allows action when user has permission", async () => {
      mockPrisma.threatModel.findUnique.mockResolvedValue({
        id: mockThreatModel.id,
        project: {
          organizationId: mockOrg.id,
          organization: {
            deletedAt: null,
            memberships: [{ role: "EDITOR" }],
          },
        },
      });

      const result = await canPerformAction(
        mockEditor.id,
        mockThreatModel.id,
        "edit",
      );

      expect(result.allowed).toBe(true);
    });

    it("denies action when user lacks permission", async () => {
      mockPrisma.threatModel.findUnique.mockResolvedValue({
        id: mockThreatModel.id,
        project: {
          organizationId: mockOrg.id,
          organization: {
            deletedAt: null,
            memberships: [{ role: "VIEWER" }],
          },
        },
      });

      const result = await canPerformAction(
        mockViewer.id,
        mockThreatModel.id,
        "edit",
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("VIEWER");
      expect(result.error).toContain("edit");
    });

    it("denies action when user has no access", async () => {
      mockPrisma.threatModel.findUnique.mockResolvedValue(null);

      const result = await canPerformAction(
        "stranger",
        mockThreatModel.id,
        "view",
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("access denied");
    });
  });

  describe("requireOrgRole", () => {
    it("allows when user has required role", async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(mockMemberships.admin);

      const result = await requireOrgRole(mockAdmin.id, mockOrg.id, "ADMIN");

      expect(result.allowed).toBe(true);
      expect(result.role).toBe("ADMIN");
    });

    it("allows when user has higher role than required", async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(mockMemberships.owner);

      const result = await requireOrgRole(mockOwner.id, mockOrg.id, "EDITOR");

      expect(result.allowed).toBe(true);
      expect(result.role).toBe("OWNER");
    });

    it("denies when user has lower role than required", async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(
        mockMemberships.viewer,
      );

      const result = await requireOrgRole(mockViewer.id, mockOrg.id, "EDITOR");

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("EDITOR");
    });

    it("denies when user is not a member", async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(null);

      const result = await requireOrgRole("stranger", mockOrg.id, "VIEWER");

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("Not a member");
    });
  });

  describe("Role permissions", () => {
    it("OWNER has all permissions", async () => {
      mockPrisma.threatModel.findUnique.mockResolvedValue({
        id: mockThreatModel.id,
        project: {
          organizationId: mockOrg.id,
          organization: {
            deletedAt: null,
            memberships: [{ role: "OWNER" }],
          },
        },
      });

      const result = await checkThreatModelAccess(
        mockOwner.id,
        mockThreatModel.id,
      );

      expect(result.permissions).toContain("view");
      expect(result.permissions).toContain("edit");
      expect(result.permissions).toContain("delete");
      expect(result.permissions).toContain("manage");
      expect(result.permissions).toContain("admin");
      expect(result.permissions).toContain("export");
    });

    it("VIEWER has only view permission", async () => {
      mockPrisma.threatModel.findUnique.mockResolvedValue({
        id: mockThreatModel.id,
        project: {
          organizationId: mockOrg.id,
          organization: {
            deletedAt: null,
            memberships: [{ role: "VIEWER" }],
          },
        },
      });

      const result = await checkThreatModelAccess(
        mockViewer.id,
        mockThreatModel.id,
      );

      expect(result.permissions).toEqual(["view"]);
    });
  });
});
