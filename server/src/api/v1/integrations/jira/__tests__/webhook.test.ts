/**
 * Jira webhook: signed with the org's webhook secret, and only touches
 * mappings that belong to the Jira integration of :orgId.
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
import { createHmac } from "crypto";
import { keepRawJsonBody } from "../../../../../utils/raw-body.js";
import Fastify, { type FastifyInstance } from "fastify";

const mockPrisma = {
  organization: { findUnique: vi.fn() },
  integration: { findFirst: vi.fn() },
  integrationMapping: { findFirst: vi.fn(), update: vi.fn() },
  threat: { findUnique: vi.fn(), update: vi.fn() },
  mitigation: { findUnique: vi.fn(), update: vi.fn() },
};

vi.mock("../../../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

const { webhookRoutes } = await import("../routes/webhook.js");

const SECRET = "org-a-secret";
const payload = {
  webhookEvent: "jira:issue_updated",
  issue: {
    key: "SEC-1",
    fields: { status: { statusCategory: { name: "Done" } } },
  },
};

function sign(body: unknown, secret = SECRET): string {
  return (
    "sha256=" +
    createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex")
  );
}

describe("POST /:orgId/integrations/jira/webhook", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    keepRawJsonBody(app);
    await app.register(webhookRoutes, { prefix: "/:orgId/integrations/jira" });
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.organization.findUnique.mockResolvedValue({
      ciWebhookSecret: SECRET,
    });
    mockPrisma.integration.findFirst.mockResolvedValue({
      id: "int-a",
      organizationId: "org-a",
    });
    mockPrisma.integrationMapping.findFirst.mockResolvedValue({
      id: "map-1",
      localType: "threat",
      localId: "threat-1",
    });
    mockPrisma.threat.findUnique.mockResolvedValue({
      id: "threat-1",
      status: "OPEN",
    });
  });

  it("rejects an unsigned request without touching any threat", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/org-a/integrations/jira/webhook",
      payload,
    });

    expect(res.statusCode).toBe(401);
    expect(mockPrisma.threat.update).not.toHaveBeenCalled();
    expect(mockPrisma.mitigation.update).not.toHaveBeenCalled();
  });

  it("rejects a request signed with the wrong secret", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/org-a/integrations/jira/webhook",
      headers: { "x-hub-signature": sign(payload, "someone-elses") },
      payload,
    });

    expect(res.statusCode).toBe(401);
    expect(mockPrisma.threat.update).not.toHaveBeenCalled();
  });

  it("returns 401 with setup guidance when the org has no secret", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      ciWebhookSecret: null,
    });

    const res = await app.inject({
      method: "POST",
      url: "/org-a/integrations/jira/webhook",
      headers: { "x-hub-signature": sign(payload) },
      payload,
    });

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatch(/webhook-secret/);
    expect(mockPrisma.threat.update).not.toHaveBeenCalled();
  });

  it("looks the mapping up only within :orgId's Jira integration", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/org-a/integrations/jira/webhook",
      headers: { "x-hub-signature": sign(payload) },
      payload,
    });

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "org-a" } }),
    );
    expect(mockPrisma.integration.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-a",
          type: "JIRA",
        }),
      }),
    );
    expect(mockPrisma.integrationMapping.findFirst).toHaveBeenCalledWith({
      where: { integrationId: "int-a", externalId: "SEC-1" },
    });
    expect(mockPrisma.threat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "threat-1" },
        data: expect.objectContaining({ status: "MITIGATED" }),
      }),
    );
  });

  it("does nothing when :orgId has no Jira integration", async () => {
    mockPrisma.integration.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: "POST",
      url: "/org-b/integrations/jira/webhook",
      headers: { "x-hub-signature": sign(payload) },
      payload,
    });

    expect(res.statusCode).toBe(404);
    expect(mockPrisma.integrationMapping.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.threat.update).not.toHaveBeenCalled();
  });
});
