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
import { webhookRoutes } from "../webhooks.js";

// Mock user for testing
const mockUser = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
};

// Mock the database module
const mockPrisma = {
  webhook: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

// Mock access control
const mockAccess = {
  hasAccess: true,
  role: "admin" as const,
  permissions: ["read", "write", "manage"],
};

vi.mock("../../services/access-control/access-control-service.js", () => ({
  checkOrganizationAccess: vi.fn(() => Promise.resolve(mockAccess)),
}));

// Mock audit logging
vi.mock("../../services/audit.js", () => ({
  logAudit: vi.fn(() => Promise.resolve()),
}));

// Mock encryption
vi.mock("../../services/encryption/encryption-service.js", () => ({
  encryptValue: vi.fn((val: string) => `encrypted:${val}`),
  decryptValue: vi.fn((val: string) => val.replace("encrypted:", "")),
}));

// Webhook URLs are resolved to check they are public; keep that off the network
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(() =>
    Promise.resolve([{ address: "93.184.216.34", family: 4 }]),
  ),
}));

// Import mocked modules for per-test overrides
import { checkOrganizationAccess } from "../../services/access-control/access-control-service.js";

const orgId = "org-123";
const webhookId = "wh-456";

function buildWebhook(overrides: Record<string, unknown> = {}) {
  return {
    id: webhookId,
    organizationId: orgId,
    name: "My Webhook",
    url: "https://example.com/hook",
    events: JSON.stringify(["threat.created", "model.updated"]),
    secret: null,
    isActive: true,
    maxRetries: 3,
    lastTriggeredAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureReason: null,
    consecutiveFailures: 0,
    totalDeliveries: 0,
    successfulDeliveries: 0,
    failedDeliveries: 0,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdById: mockUser.id,
    ...overrides,
  };
}

describe("Webhooks API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();

    // Inject authUser for all requests
    app.addHook("preHandler", async (request) => {
      request.authUser = mockUser;
    });

    await webhookRoutes(app, {});
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default access
    (checkOrganizationAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
      hasAccess: true,
      role: "admin",
      permissions: ["read", "write", "manage"],
    });
  });

  // ==========================================================================
  // GET /api/organizations/:organizationId/webhooks
  // ==========================================================================
  describe("GET /api/organizations/:orgId/webhooks", () => {
    it("returns list of webhooks for the organization", async () => {
      const webhooks = [
        buildWebhook(),
        buildWebhook({ id: "wh-789", name: "Second Hook" }),
      ];
      mockPrisma.webhook.findMany.mockResolvedValue(webhooks);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/webhooks`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(2);
      expect(body[0].id).toBe(webhookId);
      expect(body[0].events).toEqual(["threat.created", "model.updated"]);
      expect(body[0].hasSecret).toBe(false);
    });

    it("returns 403 for non-admin member", async () => {
      (checkOrganizationAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
        hasAccess: true,
        role: "member",
        permissions: ["read"],
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/webhooks`,
      });

      expect(res.statusCode).toBe(403);
    });

    it("returns 404 when user has no access to org", async () => {
      (checkOrganizationAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
        hasAccess: false,
        role: null,
        permissions: [],
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/webhooks`,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/organizations/:organizationId/webhooks
  // ==========================================================================
  describe("POST /api/organizations/:orgId/webhooks", () => {
    const validPayload = {
      name: "New Webhook",
      url: "https://example.com/hook",
      events: ["threat.created"],
    };

    it("creates a webhook successfully", async () => {
      mockPrisma.webhook.count.mockResolvedValue(0);
      const created = buildWebhook({ name: "New Webhook" });
      mockPrisma.webhook.create.mockResolvedValue(created);

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/webhooks`,
        payload: validPayload,
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.name).toBe("New Webhook");
      expect(mockPrisma.webhook.create).toHaveBeenCalledTimes(1);
    });

    it("rejects invalid URL format", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/webhooks`,
        payload: { ...validPayload, url: "not-a-url" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("not a valid URL");
    });

    it("rejects non-http(s) URL", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/webhooks`,
        payload: { ...validPayload, url: "ftp://example.com/hook" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("http or https");
    });

    it("rejects invalid webhook events", async () => {
      mockPrisma.webhook.count.mockResolvedValue(0);

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/webhooks`,
        payload: { ...validPayload, events: ["threat.created", "bogus.event"] },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Invalid events");
      expect(res.json().error).toContain("bogus.event");
    });

    it("rejects when missing required fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/webhooks`,
        payload: { name: "Test" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects when webhook limit (10) is reached", async () => {
      mockPrisma.webhook.count.mockResolvedValue(10);

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/webhooks`,
        payload: validPayload,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Maximum of 10");
    });
  });

  // ==========================================================================
  // PATCH /api/organizations/:organizationId/webhooks/:webhookId
  // ==========================================================================
  describe("PATCH /api/organizations/:orgId/webhooks/:webhookId", () => {
    it("updates webhook URL successfully", async () => {
      const existing = buildWebhook();
      mockPrisma.webhook.findFirst.mockResolvedValue(existing);
      const updated = buildWebhook({
        url: "https://new-url.com/hook",
        updatedAt: new Date(),
      });
      mockPrisma.webhook.update.mockResolvedValue(updated);

      const res = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${orgId}/webhooks/${webhookId}`,
        payload: { url: "https://new-url.com/hook" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().url).toBe("https://new-url.com/hook");
    });

    it("returns 404 when webhook not found", async () => {
      mockPrisma.webhook.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${orgId}/webhooks/nonexistent`,
        payload: { name: "Updated" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("rejects invalid URL on update", async () => {
      const existing = buildWebhook();
      mockPrisma.webhook.findFirst.mockResolvedValue(existing);

      const res = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${orgId}/webhooks/${webhookId}`,
        payload: { url: "bad-url" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects invalid events on update", async () => {
      const existing = buildWebhook();
      mockPrisma.webhook.findFirst.mockResolvedValue(existing);

      const res = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${orgId}/webhooks/${webhookId}`,
        payload: { events: ["invalid.event"] },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Invalid events");
    });
  });

  // ==========================================================================
  // DELETE /api/organizations/:organizationId/webhooks/:webhookId
  // ==========================================================================
  describe("DELETE /api/organizations/:orgId/webhooks/:webhookId", () => {
    it("deletes webhook successfully", async () => {
      const existing = buildWebhook();
      mockPrisma.webhook.findFirst.mockResolvedValue(existing);
      mockPrisma.webhook.delete.mockResolvedValue(existing);

      const res = await app.inject({
        method: "DELETE",
        url: `/api/organizations/${orgId}/webhooks/${webhookId}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(mockPrisma.webhook.delete).toHaveBeenCalledWith({
        where: { id: webhookId },
      });
    });

    it("returns 404 when webhook not found", async () => {
      mockPrisma.webhook.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: "DELETE",
        url: `/api/organizations/${orgId}/webhooks/nonexistent`,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/organizations/:organizationId/webhooks/:webhookId/test
  // ==========================================================================
  describe("POST /api/organizations/:orgId/webhooks/:webhookId/test", () => {
    it("sends a test delivery and returns success", async () => {
      const existing = buildWebhook();
      mockPrisma.webhook.findFirst.mockResolvedValue(existing);
      mockPrisma.webhook.update.mockResolvedValue(existing);

      // Mock global fetch
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve("OK"),
      });
      vi.stubGlobal("fetch", mockFetch);

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/webhooks/${webhookId}/test`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.statusCode).toBe(200);
      expect(body.message).toContain("successful");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      vi.unstubAllGlobals();
    });

    it("returns failure when fetch throws (e.g. timeout)", async () => {
      const existing = buildWebhook();
      mockPrisma.webhook.findFirst.mockResolvedValue(existing);
      mockPrisma.webhook.update.mockResolvedValue(existing);

      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Connection refused")),
      );

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/webhooks/${webhookId}/test`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain("Connection refused");

      vi.unstubAllGlobals();
    });

    it("returns 404 when webhook not found for test", async () => {
      mockPrisma.webhook.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/webhooks/nonexistent/test`,
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
