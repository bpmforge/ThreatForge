/**
 * /api/threats/:threatId/mitigations* were gated by canAccessThreat, which
 * matched any membership row (SUSPENDED included) and never checked a role,
 * so a viewer — or a suspended member — could create, edit, delete and move
 * mitigations. Reads need view on the threat's model; writes need edit.
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
import { createFakePrisma } from "../../test/helpers/fake-prisma.js";

const prisma = createFakePrisma({
  threat: [
    { id: "t1", threatModelId: "m1" },
    { id: "t2", threatModelId: "m1" },
  ],
  mitigation: [{ id: "mit1", threatId: "t1" }],
  requirement: [
    { id: "req-own", threatModelId: "m1" },
    { id: "req-other", threatModelId: "victim" },
  ],
});

const repo = {
  list: vi.fn(async () => ({
    data: [],
    pagination: { page: 1, limit: 20, total: 0 },
  })),
  getById: vi.fn(async () => ({
    id: "mit1",
    threatId: "t1",
    description: "d",
  })),
  create: vi.fn(async () => ({
    id: "mit-new",
    status: "PLANNED",
    description: "d",
  })),
  update: vi.fn(async () => ({
    id: "mit1",
    status: "PLANNED",
    description: "d",
  })),
  delete: vi.fn(async () => undefined),
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(prisma)),
}));
vi.mock("../../repositories/index.js", () => ({ mitigationRepository: repo }));
vi.mock("../../services/audit.js", () => ({
  logAudit: vi.fn(() => Promise.resolve()),
}));
vi.mock("../../services/webhooks/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn(),
}));
vi.mock("../../services/access-control/access-control-service.js", async () => {
  const mock = await import("../../test/helpers/access-control-mock.js");
  return {
    ...mock.accessControlModule,
    // Old gate: true for any membership row. Kept so the old code runs.
    canAccessThreat: vi.fn(async () => true),
    getOrgIdFromThreat: vi.fn(async () => "o1"),
  };
});

const { modelGrants, resetGrants } = await import(
  "../../test/helpers/access-control-mock.js"
);
const { mitigationRoutes } = await import("../mitigations.js");

const base = "/api/threats/t1/mitigations";
const writes = [
  { method: "POST", url: base, payload: { description: "d" } },
  { method: "PATCH", url: `${base}/mit1`, payload: { notes: "n" } },
  { method: "DELETE", url: `${base}/mit1` },
  {
    method: "PATCH",
    url: `${base}/mit1/move`,
    payload: { targetThreatId: "t2" },
  },
] as const;

describe("threat mitigation routes authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(mitigationRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    resetGrants();
  });

  const wrote = () =>
    repo.create.mock.calls.length +
    repo.update.mock.calls.length +
    repo.delete.mock.calls.length +
    prisma.mitigation.update.mock.calls.length;

  for (const w of writes) {
    it(`${w.method} ${w.url}: 404 without access`, async () => {
      expect((await app.inject({ ...w })).statusCode).toBe(404);
      expect(wrote()).toBe(0);
    });

    it(`${w.method} ${w.url}: 403 for a viewer and a guest viewer`, async () => {
      for (const grant of [
        { role: "VIEWER" as const },
        { role: "VIEWER" as const, guest: true },
      ]) {
        modelGrants.set("m1", grant);
        expect((await app.inject({ ...w })).statusCode).toBe(403);
      }
      expect(wrote()).toBe(0);
    });

    it(`${w.method} ${w.url}: an editor gets through`, async () => {
      modelGrants.set("m1", { role: "EDITOR", organizationId: "o1" });
      expect((await app.inject({ ...w })).statusCode).toBeLessThan(300);
    });
  }

  it("GET list: a viewer can read; no access is 404", async () => {
    expect((await app.inject({ method: "GET", url: base })).statusCode).toBe(
      404,
    );
    modelGrants.set("m1", { role: "VIEWER" });
    expect((await app.inject({ method: "GET", url: base })).statusCode).toBe(
      200,
    );
  });

  it("PATCH requirementIds: 400 when one belongs to another model", async () => {
    modelGrants.set("m1", { role: "EDITOR", organizationId: "o1" });
    const url = `${base}/mit1`;

    const bad = await app.inject({
      method: "PATCH",
      url,
      payload: { requirementIds: ["req-own", "req-other"] },
    });
    expect(bad.statusCode).toBe(400);
    expect(repo.update).not.toHaveBeenCalled();

    const ok = await app.inject({
      method: "PATCH",
      url,
      payload: { requirementIds: ["req-own"] },
    });
    expect(ok.statusCode).toBeLessThan(300);
    expect(repo.update).toHaveBeenCalledTimes(1);
  });
});
