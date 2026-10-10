/**
 * Audit API Tests
 *
 * Tests for audit log query endpoints:
 * - Organization audit logs (admin only)
 * - Threat model audit logs (member access)
 * - AI usage stats
 * - Audit stats
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
import { auditRoutes } from "../audit.js";

const mockUser = { id: "user-1", email: "test@example.com", name: "Test User" };

// Mock access control
vi.mock("../../services/access-control/access-control-service.js", () => ({
  checkOrganizationAccess: vi.fn(),
  checkThreatModelAccess: vi.fn(),
}));

// Mock audit service
vi.mock("../../services/audit.js", () => ({
  queryAuditLogs: vi.fn(),
  getOrganizationAIUsage: vi.fn(),
}));

import {
  checkOrganizationAccess,
  checkThreatModelAccess,
} from "../../services/access-control/access-control-service.js";
import {
  queryAuditLogs,
  getOrganizationAIUsage,
} from "../../services/audit.js";

const mockCheckOrgAccess = checkOrganizationAccess as ReturnType<typeof vi.fn>;
const mockCheckModelAccess = checkThreatModelAccess as ReturnType<typeof vi.fn>;
const mockQueryAuditLogs = queryAuditLogs as ReturnType<typeof vi.fn>;
const mockGetAIUsage = getOrganizationAIUsage as ReturnType<typeof vi.fn>;

describe("Audit API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = mockUser;
    });
    await auditRoutes(app, {});
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/organizations/:organizationId/audit", () => {
    it("returns audit logs for admin user", async () => {
      mockCheckOrgAccess.mockResolvedValue({
        hasAccess: true,
        role: "OWNER",
        permissions: ["view", "manage"],
      });
      mockQueryAuditLogs.mockResolvedValue({
        logs: [
          {
            id: "log-1",
            scope: "ORGANIZATION",
            action: "CREATE",
            resourceType: "THREAT_MODEL",
            resourceId: "tm-1",
            resourceName: "Test Model",
            changes: null,
            metadata: null,
            userId: "user-1",
            userEmail: "test@example.com",
            createdAt: new Date("2026-01-01"),
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/organizations/org-1/audit",
      });

      expect(response.statusCode).toBe(200);
      expect(mockQueryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: "org-1" }),
      );
    });

    it("returns 403 for non-admin user", async () => {
      mockCheckOrgAccess.mockResolvedValue({
        hasAccess: true,
        role: "VIEWER",
        permissions: ["view"],
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/organizations/org-1/audit",
      });

      expect(response.statusCode).toBe(403);
    });

    it("returns 404 when org not found", async () => {
      mockCheckOrgAccess.mockResolvedValue({
        hasAccess: false,
        permissions: [],
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/organizations/nonexistent/audit",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/threat-models/:threatModelId/audit", () => {
    it("returns audit logs for threat model member", async () => {
      mockCheckModelAccess.mockResolvedValue({
        hasAccess: true,
        role: "EDITOR",
        permissions: ["view", "edit"],
      });
      mockQueryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/threat-models/tm-1/audit",
      });

      expect(response.statusCode).toBe(200);
      expect(mockQueryAuditLogs).toHaveBeenCalled();
    });

    it("returns 404 when no access to model", async () => {
      mockCheckModelAccess.mockResolvedValue({
        hasAccess: false,
        permissions: [],
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/threat-models/tm-1/audit",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/organizations/:organizationId/ai-usage", () => {
    it("returns AI usage for admin", async () => {
      mockCheckOrgAccess.mockResolvedValue({
        hasAccess: true,
        role: "OWNER",
        permissions: ["view", "manage"],
      });
      mockGetAIUsage.mockResolvedValue({
        summary: { totalRequests: 10, totalTokens: 5000 },
        byProvider: [],
        byModel: [],
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/organizations/org-1/ai-usage",
      });

      expect(response.statusCode).toBe(200);
      expect(mockGetAIUsage).toHaveBeenCalledWith(
        "org-1",
        undefined,
        undefined,
      );
    });

    it("returns 403 for non-admin", async () => {
      mockCheckOrgAccess.mockResolvedValue({
        hasAccess: true,
        role: "EDITOR",
        permissions: ["view", "edit"],
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/organizations/org-1/ai-usage",
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("GET /api/organizations/:organizationId/audit/stats", () => {
    it("returns audit stats for admin", async () => {
      mockCheckOrgAccess.mockResolvedValue({
        hasAccess: true,
        role: "ADMIN",
        permissions: ["view", "manage"],
      });
      mockQueryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 1000,
        offset: 0,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/organizations/org-1/audit/stats",
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
