/**
 * Members API Tests
 *
 * Tests for organization member management:
 * - List members
 * - Update member role
 * - Remove member
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
import { memberRoutes } from "../members.js";

const mockUser = { id: "user-1", email: "test@example.com", name: "Test User" };

// Mock membership service
vi.mock("../../services/membership/membership-service.js", () => ({
  getOrganizationMembers: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
  leaveOrganization: vi.fn(),
  suspendMember: vi.fn(),
  unsuspendMember: vi.fn(),
}));

// Mock webhook dispatcher
vi.mock("../../services/webhooks/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn(),
}));

import {
  getOrganizationMembers,
  updateMemberRole,
  removeMember,
  suspendMember,
  unsuspendMember,
} from "../../services/membership/membership-service.js";

const mockGetMembers = getOrganizationMembers as ReturnType<typeof vi.fn>;
const mockUpdateRole = updateMemberRole as ReturnType<typeof vi.fn>;
const mockRemoveMember = removeMember as ReturnType<typeof vi.fn>;
const mockSuspend = suspendMember as ReturnType<typeof vi.fn>;
const mockUnsuspend = unsuspendMember as ReturnType<typeof vi.fn>;

describe("Members API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = mockUser;
    });
    await memberRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/organizations/:organizationId/members", () => {
    it("returns member list", async () => {
      mockGetMembers.mockResolvedValue({
        success: true,
        members: [
          {
            id: "m-1",
            userId: "user-1",
            role: "OWNER",
            user: {
              id: "user-1",
              name: "Test User",
              email: "test@example.com",
            },
          },
        ],
        total: 1,
        canManageMembers: true,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/organizations/org-1/members",
      });

      expect(response.statusCode).toBe(200);
      expect(mockGetMembers).toHaveBeenCalledWith(
        "org-1",
        "user-1",
        expect.any(Object),
      );
    });

    it("returns 403 when not a member", async () => {
      mockGetMembers.mockResolvedValue({
        success: false,
        error: "Not a member of this organization",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/organizations/org-1/members",
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PATCH /api/organizations/:organizationId/members/:memberId", () => {
    it("updates member role", async () => {
      mockUpdateRole.mockResolvedValue({
        success: true,
        previousRole: "VIEWER",
        newRole: "EDITOR",
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/organizations/org-1/members/m-1",
        payload: { role: "EDITOR" },
      });

      expect(response.statusCode).toBe(200);
      expect(mockUpdateRole).toHaveBeenCalled();
    });

    it("returns 403 when lacking permissions", async () => {
      mockUpdateRole.mockResolvedValue({
        success: false,
        error: "Cannot change roles without permissions",
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/organizations/org-1/members/m-1",
        payload: { role: "ADMIN" },
      });

      expect(response.statusCode).toBe(403);
    });

    it("returns 400 for invalid role", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/organizations/org-1/members/m-1",
        payload: { role: "SUPERADMIN" },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("DELETE /api/organizations/:organizationId/members/:memberId", () => {
    it("removes a member", async () => {
      mockRemoveMember.mockResolvedValue({
        success: true,
        removedUserId: "user-2",
        removedUserEmail: "removed@example.com",
      });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/organizations/org-1/members/m-2",
      });

      expect(response.statusCode).toBe(200);
      expect(mockRemoveMember).toHaveBeenCalled();
    });

    it("returns 403 when cannot remove", async () => {
      mockRemoveMember.mockResolvedValue({
        success: false,
        error: "Cannot remove the last owner",
      });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/organizations/org-1/members/m-1",
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("member mutations are bound to the URL organization", () => {
    const notFound = { success: false, error: "Membership not found" };

    it("PATCH passes the URL org and returns 404 for another org's member", async () => {
      mockUpdateRole.mockResolvedValue(notFound);
      const response = await app.inject({
        method: "PATCH",
        url: "/api/organizations/org-1/members/m-other",
        payload: { role: "EDITOR" },
      });
      expect(mockUpdateRole).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: "org-1" }),
      );
      expect(response.statusCode).toBe(404);
    });

    it("POST suspend passes the URL org and returns 404 for another org's member", async () => {
      mockSuspend.mockResolvedValue(notFound);
      const response = await app.inject({
        method: "POST",
        url: "/api/organizations/org-1/members/m-other/suspend",
        payload: {},
      });
      expect(mockSuspend).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: "org-1" }),
      );
      expect(response.statusCode).toBe(404);
    });

    it("DELETE suspend passes the URL org and returns 404 for another org's member", async () => {
      mockUnsuspend.mockResolvedValue(notFound);
      const response = await app.inject({
        method: "DELETE",
        url: "/api/organizations/org-1/members/m-other/suspend",
      });
      expect(mockUnsuspend).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: "org-1" }),
      );
      expect(response.statusCode).toBe(404);
    });
  });
});
