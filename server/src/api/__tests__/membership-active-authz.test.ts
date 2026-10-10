/**
 * Org-membership helpers used to match any Membership row, so a SUSPENDED
 * (or INVITED/REMOVED) member kept the access their role implied. Every
 * helper must answer as if the inactive row were not there.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import { createFakePrisma } from "../../test/helpers/fake-prisma.js";

const tables = {
  membership: [
    {
      id: "m-active",
      userId: "active",
      organizationId: "o1",
      role: "ADMIN",
      status: "ACTIVE",
    },
    {
      id: "m-suspended",
      userId: "suspended",
      organizationId: "o1",
      role: "OWNER",
      status: "SUSPENDED",
    },
  ],
};
let prisma = createFakePrisma(tables);

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(prisma)),
}));

const orgHelpers = await import("../organizations/helpers.js");
const libraryHelpers = await import("../threat-library/helpers.js");
const componentHelpers = await import("../component-templates/helpers.js");
const promptHelpers = await import("../prompts/helpers.js");
const providerHelpers = await import("../ai-providers/helpers.js");
const ciHelpers = await import("../ci/helpers.js");
const { apiKeyRoutes } = await import("../ci/routes/api-keys.js");
const { webhookSecretRoutes } = await import("../ci/routes/webhook-secret.js");
const { riskOverviewRoutes } = await import("../risk-overview.js");

type Check = (userId: string, orgId: string) => Promise<unknown>;

const memberChecks: Record<string, Check> = {
  "organizations isMemberOfOrganization": orgHelpers.isMemberOfOrganization,
  "threat-library isMemberOfOrganization":
    libraryHelpers.isMemberOfOrganization,
  "component-templates isMemberOfOrganization":
    componentHelpers.isMemberOfOrganization,
  "prompts isOrgMember": promptHelpers.isOrgMember,
  "ai-providers isOrgMember": providerHelpers.isOrgMember,
};

const adminChecks: Record<string, Check> = {
  "threat-library isOrgAdmin": libraryHelpers.isOrgAdmin,
  "component-templates isOrgAdmin": componentHelpers.isOrgAdmin,
  "prompts hasOrgAdminAccess": promptHelpers.hasOrgAdminAccess,
  "ai-providers hasOrgAdminAccess": providerHelpers.hasOrgAdminAccess,
  "ci isOrgAdmin": ciHelpers.isOrgAdmin,
};

describe("org membership helpers require an ACTIVE membership", () => {
  beforeEach(() => {
    prisma = createFakePrisma(tables);
  });

  for (const [name, check] of Object.entries({
    ...memberChecks,
    ...adminChecks,
  })) {
    it(`${name}: active member allowed, suspended member refused`, async () => {
      expect(await check("active", "o1")).toBe(true);
      expect(await check("suspended", "o1")).toBe(false);
      expect(await check("stranger", "o1")).toBe(false);
    });
  }

  it("organizations getUserRole returns null for a suspended member", async () => {
    expect(await orgHelpers.getUserRole("active", "o1")).toBe("ADMIN");
    expect(await orgHelpers.getUserRole("suspended", "o1")).toBeNull();
  });

  it("threat-library getUserOrganizationIds skips suspended memberships", async () => {
    expect(await libraryHelpers.getUserOrganizationIds("active")).toEqual([
      "o1",
    ]);
    expect(await libraryHelpers.getUserOrganizationIds("suspended")).toEqual(
      [],
    );
  });
});

describe("inline org checks refuse a suspended member", () => {
  beforeEach(() => {
    prisma = createFakePrisma({
      ...tables,
      cIApiKey: [],
      organization: [{ id: "o1", ciWebhookSecret: null }],
      project: [],
    });
  });

  async function as(userId: string, url: string) {
    const app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: userId, email: "u@x.test", name: "U" };
    });
    await app.register(apiKeyRoutes);
    await app.register(webhookSecretRoutes);
    await app.register(riskOverviewRoutes);
    const res = await app.inject({ method: "GET", url });
    await app.close();
    return res.statusCode;
  }

  for (const url of [
    "/api/ci/api-keys?organizationId=o1",
    "/api/ci/webhook-secret?organizationId=o1",
    "/api/organizations/o1/risk-overview",
  ]) {
    it(`GET ${url}`, async () => {
      expect(await as("active", url)).toBe(200);
      expect(await as("suspended", url)).toBe(403);
    });
  }
});
