/**
 * Bulk threat/component routes: the bulk update path wrote by threat id
 * alone (not bound to :modelId), and every bulk write was gated only by
 * view-level access.
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
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  threatModel: { findUnique: vi.fn(), update: vi.fn() },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../services/webhooks/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn(),
}));
vi.mock(
  "../../services/access-control/access-control-service.js",
  async () =>
    (await import("../../test/helpers/access-control-mock.js"))
      .accessControlModule,
);

const { modelGrants, resetGrants } = await import(
  "../../test/helpers/access-control-mock.js"
);
const { bulkRoutes } = await import("../bulk.js");

const url = "/api/threat-models/m1/bulk/threats";

describe("bulk routes authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(bulkRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    resetGrants();
    mockPrisma.threat.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.threat.update.mockResolvedValue({});
    mockPrisma.threat.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.threat.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.threatModel.findUnique.mockResolvedValue({
      canvasState: { nodes: [] },
      project: { organizationId: "org1" },
    });
  });

  describe("POST bulk/threats", () => {
    it("binds updates to :modelId so a foreign threat id is not touched", async () => {
      modelGrants.set("m1", { role: "EDITOR" });
      mockPrisma.threat.updateMany.mockResolvedValue({ count: 0 });

      const res = await app.inject({
        method: "POST",
        url,
        payload: { update: [{ id: "foreign-threat", status: "ACCEPTED" }] },
      });

      expect(mockPrisma.threat.update).not.toHaveBeenCalled();
      expect(mockPrisma.threat.updateMany).toHaveBeenCalledWith({
        where: { id: "foreign-threat", threatModelId: "m1" },
        data: { status: "ACCEPTED" },
      });
      const body = res.json().data;
      expect(body.updated).toBe(0);
      expect(body.errors?.[0]).toMatch(/foreign-threat/);
    });

    it("returns 404 without access", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/threat-models/victim/bulk/threats",
        payload: { create: [{ name: "x", strideCategories: ["SPOOFING"] }] },
      });
      expect(res.statusCode).toBe(404);
    });

    it("returns 403 for a viewer and writes nothing", async () => {
      modelGrants.set("m1", { role: "VIEWER" });
      const res = await app.inject({
        method: "POST",
        url,
        payload: {
          create: [{ name: "x", strideCategories: ["SPOOFING"] }],
          update: [{ id: "t1", status: "ACCEPTED" }],
        },
      });
      expect(res.statusCode).toBe(403);
      expect(mockPrisma.threat.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.threat.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.threat.update).not.toHaveBeenCalled();
    });

    it("returns 403 for a viewer sending delete[]", async () => {
      modelGrants.set("m1", { role: "VIEWER" });
      const res = await app.inject({
        method: "POST",
        url,
        payload: { delete: ["t1"] },
      });
      expect(res.statusCode).toBe(403);
      expect(mockPrisma.threat.deleteMany).not.toHaveBeenCalled();
    });

    it("lets an editor create and update", async () => {
      modelGrants.set("m1", { role: "EDITOR" });
      const res = await app.inject({
        method: "POST",
        url,
        payload: {
          create: [{ name: "x", strideCategories: ["SPOOFING"] }],
          update: [{ id: "t1", status: "ACCEPTED" }],
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toMatchObject({ created: 1, updated: 1 });
    });

    it("lets an admin delete", async () => {
      modelGrants.set("m1", { role: "ADMIN" });
      const res = await app.inject({
        method: "POST",
        url,
        payload: { delete: ["t1"] },
      });
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.threat.deleteMany).toHaveBeenCalled();
    });
  });

  describe("DELETE bulk/threats", () => {
    it("returns 403 for a viewer", async () => {
      modelGrants.set("m1", { role: "VIEWER" });
      const res = await app.inject({
        method: "DELETE",
        url,
        payload: { ids: ["t1"] },
      });
      expect(res.statusCode).toBe(403);
      expect(mockPrisma.threat.deleteMany).not.toHaveBeenCalled();
    });

    // Deleting threats is ordinary editing, as in the single-threat route.
    it("deletes for an editor", async () => {
      modelGrants.set("m1", { role: "EDITOR" });
      const res = await app.inject({
        method: "DELETE",
        url,
        payload: { ids: ["t1"] },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  it.each([
    [
      "PATCH",
      "/api/threat-models/m1/bulk/threats/severity",
      { ids: ["t1"], severity: "LOW" },
    ],
    [
      "PATCH",
      "/api/threat-models/m1/bulk/threats/status",
      { ids: ["t1"], status: "ACCEPTED" },
    ],
    [
      "POST",
      "/api/threat-models/m1/bulk/components",
      { nodeIds: ["n1"], updates: { name: "y" } },
    ],
  ] as const)(
    "%s %s returns 403 for a viewer",
    async (method, path, payload) => {
      modelGrants.set("m1", { role: "VIEWER" });
      const res = await app.inject({ method, url: path, payload });
      expect(res.statusCode).toBe(403);
      expect(mockPrisma.threat.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.threatModel.update).not.toHaveBeenCalled();
    },
  );
});
