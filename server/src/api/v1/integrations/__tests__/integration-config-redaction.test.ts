/**
 * GET /:orgId/integrations/:id returned the decrypted config minus only
 * apiToken and clientSecret: any other credential-shaped key (accessToken,
 * refreshToken, privateKey, webhookUrl, password...) went to every org member.
 * Credential-shaped keys are now dropped at any depth.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { createFakePrisma } from "../../../../test/helpers/fake-prisma.js";

const config = {
  baseUrl: "https://jira.example",
  projectKey: "SEC",
  owner: "acme",
  repo: "app",
  apiToken: "t1",
  accessToken: "t2",
  refreshToken: "t3",
  clientSecret: "s1",
  privateKey: "k1",
  webhookUrl: "https://hooks.example/x",
  password: "p1",
  nested: { signingSecret: "s2", label: "keep" },
};
const now = new Date();
const prisma = createFakePrisma({
  integration: [
    {
      id: "int-1",
      organizationId: "o1",
      type: "JIRA",
      name: "Jira",
      status: "ACTIVE",
      config: JSON.stringify(config),
      scopes: "[]",
      createdBy: null,
      _count: { mappings: 0 },
      createdAt: now,
      updatedAt: now,
    },
  ],
});
vi.mock("../../../../db.js", () => ({ getPrisma: vi.fn(async () => prisma) }));
vi.mock("../../helpers.js", () => ({
  getAuthUser: () => ({ id: "u1", email: "u1@x.test" }),
  checkOrganizationAccess: vi.fn(async () => ({
    hasAccess: true,
    role: "VIEWER",
  })),
  logAudit: vi.fn(),
}));
vi.mock("../../../../services/encryption/encryption-service.js", () => ({
  decryptValue: (v: string) => v,
  encryptValue: (v: string) => v,
}));

const { integrationRoutes } = await import("../index.js");

describe("integration config redaction", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = Fastify();
    await app.register(integrationRoutes);
    await app.ready();
  });
  afterAll(() => app.close());

  it("returns only non-credential config keys", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/o1/integrations/int-1",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.config).toEqual({
      baseUrl: "https://jira.example",
      projectKey: "SEC",
      owner: "acme",
      repo: "app",
      nested: { label: "keep" },
    });
  });
});
