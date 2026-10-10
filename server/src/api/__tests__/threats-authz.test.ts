/**
 * Single-threat writes (create, update, delete, review) need edit on the
 * model. They were gated by view-level membership, so a VIEWER could change
 * threats one at a time.
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

const mockPrisma = {
  threat: {
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
  },
  threatModel: { findUnique: vi.fn() },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../services/webhooks/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn(),
}));
vi.mock("../../services/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock(
  "../../services/access-control/access-control-service.js",
  async () =>
    (await import("../../test/helpers/access-control-mock.js"))
      .accessControlModule,
);

const { modelGrants, orgUserRoles, resetGrants } = await import(
  "../../test/helpers/access-control-mock.js"
);
const { threatRepository } = await import("../../repositories/index.js");
const { threatRoutes } = await import("../threats.js");

describe("single-threat write authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(threatRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    resetGrants();
    modelGrants.set("m1", { role: "VIEWER" });
  });

  it.each([
    [
      "POST",
      "/api/threat-models/m1/threats",
      { name: "x", strideCategories: ["SPOOFING"] },
    ],
    ["PATCH", "/api/threat-models/m1/threats/t1", { name: "renamed" }],
    ["DELETE", "/api/threat-models/m1/threats/t1", undefined],
  ] as const)("refuses a VIEWER: %s %s", async (method, url, payload) => {
    const writes = [
      vi.spyOn(threatRepository, "create"),
      vi.spyOn(threatRepository, "update"),
      vi.spyOn(threatRepository, "delete"),
    ];

    const res = await app.inject({
      method,
      url,
      ...(payload ? { payload } : {}),
    });

    expect(res.statusCode).toBe(403);
    for (const spy of writes) expect(spy).not.toHaveBeenCalled();
    expect(mockPrisma.threat.update).not.toHaveBeenCalled();
    expect(mockPrisma.threat.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when the caller has no access to the model", async () => {
    resetGrants();

    const res = await app.inject({
      method: "DELETE",
      url: "/api/threat-models/m1/threats/t1",
    });

    expect(res.statusCode).toBe(404);
  });

  it("PATCH assigneeId: 400 unless the assignee is an active org member", async () => {
    modelGrants.set("m1", { role: "EDITOR", organizationId: "o1" });
    orgUserRoles.set("o1:alice", "VIEWER");
    const update = vi.spyOn(threatRepository, "update");

    const outsider = await app.inject({
      method: "PATCH",
      url: "/api/threat-models/m1/threats/t1",
      payload: { assigneeId: "outsider" },
    });
    expect(outsider.statusCode).toBe(400);
    expect(update).not.toHaveBeenCalled();

    update.mockResolvedValue({ id: "t1", name: "n" } as never);
    const { logAudit } = await import("../../services/audit.js");
    vi.mocked(logAudit).mockResolvedValue(undefined as never);
    for (const assigneeId of ["alice", null]) {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/threat-models/m1/threats/t1",
        payload: { assigneeId },
      });
      expect(res.statusCode).toBeLessThan(300);
    }
  });
});
