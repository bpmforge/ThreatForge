/**
 * v1 integrations authorization: mappings and sync logs are only readable
 * when the integration belongs to the org in the URL.
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
import Fastify, { type FastifyInstance } from "fastify";
import { createFakePrisma } from "../../../../test/helpers/fake-prisma.js";

const prisma = createFakePrisma({
  integration: [
    { id: "int-a", organizationId: "org-a" },
    { id: "int-b", organizationId: "org-b" },
  ],
  integrationMapping: [],
  integrationSyncLog: [],
});

vi.mock("../../../../db.js", () => ({ getPrisma: vi.fn(async () => prisma) }));
vi.mock(
  "../../../../services/access-control/access-control-service.js",
  () => ({
    checkOrganizationAccess: vi.fn(async (_u: string, orgId: string) =>
      orgId === "org-a"
        ? { hasAccess: true, role: "MEMBER", permissions: [], isGuest: false }
        : { hasAccess: false, permissions: [], isGuest: false },
    ),
  }),
);

const { integrationRoutes } = await import("../index.js");

describe("v1 integrations authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "u1", email: "u1@x.test", name: "U1" };
    });
    await app.register(integrationRoutes, { prefix: "/api/v1/organizations" });
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  for (const sub of ["mappings", "sync-logs"]) {
    it(`does not list ${sub} of another org's integration`, async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/organizations/org-a/integrations/int-b/${sub}`,
      });
      expect(res.statusCode).toBe(404);
      expect(prisma.integrationMapping.findMany).not.toHaveBeenCalled();
      expect(prisma.integrationSyncLog.findMany).not.toHaveBeenCalled();
    });

    it(`lists ${sub} of the org's own integration`, async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/organizations/org-a/integrations/int-a/${sub}`,
      });
      expect(res.statusCode).toBe(200);
    });
  }
});
