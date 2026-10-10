/**
 * POST /api/organizations/:orgId/freshness/trigger let any member run the
 * freshness check, and the check ran across every organization (notifying
 * other tenants' members). It now needs org ADMIN and runs for that org only.
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

vi.mock(
  "../../services/access-control/access-control-service.js",
  async () =>
    (await import("../../test/helpers/access-control-mock.js"))
      .accessControlModule,
);
const runFreshnessCheck = vi.fn(async () => ({ notified: 0, skipped: 0 }));
vi.mock("../../jobs/freshness-queue.js", () => ({ runFreshnessCheck }));
vi.mock("../../services/freshness/freshness-check.js", () => ({
  findStaleModels: vi.fn(async () => []),
}));

const { orgRoles, resetGrants } = await import(
  "../../test/helpers/access-control-mock.js"
);
const { freshnessRoutes } = await import(
  "../organizations/routes/freshness.js"
);

describe("freshness trigger", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(freshnessRoutes);
    await app.ready();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    vi.clearAllMocks();
    resetGrants();
  });

  const trigger = () =>
    app.inject({
      method: "POST",
      url: "/api/organizations/o1/freshness/trigger",
    });

  it("403 for an editor", async () => {
    orgRoles.set("o1", "EDITOR");
    expect((await trigger()).statusCode).toBe(403);
    expect(runFreshnessCheck).not.toHaveBeenCalled();
  });

  it("an admin runs it for that org only", async () => {
    orgRoles.set("o1", "ADMIN");
    expect((await trigger()).statusCode).toBe(200);
    expect(runFreshnessCheck).toHaveBeenCalledWith({ organizationId: "o1" });
  });
});
