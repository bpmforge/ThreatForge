/**
 * Compliance evidence routes had no authorization at all: GET and DELETE
 * served any model/evidence id to any signed-in user, and the writes read
 * `request.user`, which the auth middleware never sets (it sets authUser),
 * so they 500'd for everyone.
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
  controlImplementation: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  controlEvidence: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock(
  "../../services/access-control/access-control-service.js",
  async () =>
    (await import("../../test/helpers/access-control-mock.js"))
      .accessControlModule,
);

const { modelGrants, orgUserRoles, resetGrants } = await import(
  "../../test/helpers/access-control-mock.js"
);
const { complianceEvidenceRoutes } = await import("../compliance-evidence.js");

const base = "/api/threat-models";

describe("compliance evidence authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(complianceEvidenceRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    resetGrants();
    mockPrisma.controlImplementation.findMany.mockResolvedValue([]);
    mockPrisma.controlImplementation.upsert.mockResolvedValue({ id: "impl" });
    mockPrisma.controlImplementation.update.mockResolvedValue({ id: "impl" });
    mockPrisma.controlImplementation.findUnique.mockResolvedValue({
      id: "impl",
    });
    mockPrisma.controlEvidence.create.mockResolvedValue({ id: "ev" });
    mockPrisma.controlEvidence.findUnique.mockResolvedValue({
      implementation: { threatModelId: "victim" },
    });
  });

  it("GET returns 404 without access and reads nothing", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${base}/victim/compliance-evidence/HIPAA`,
    });
    expect(res.statusCode).toBe(404);
    expect(mockPrisma.controlImplementation.findMany).not.toHaveBeenCalled();
  });

  it("GET allows a viewer", async () => {
    modelGrants.set("m1", { role: "VIEWER" });
    const res = await app.inject({
      method: "GET",
      url: `${base}/m1/compliance-evidence/HIPAA`,
    });
    expect(res.statusCode).toBe(200);
  });

  const writes = [
    {
      method: "PUT" as const,
      path: "compliance-evidence/HIPAA/AC-1",
      payload: { status: "IN_PROGRESS" },
    },
    {
      method: "POST" as const,
      path: "compliance-evidence/HIPAA/AC-1/verify",
      payload: {},
    },
    {
      method: "POST" as const,
      path: "compliance-evidence/HIPAA/AC-1/evidence",
      payload: { evidenceType: "POLICY", title: "p" },
    },
  ];

  for (const w of writes) {
    it(`${w.method} ${w.path}: 404 without access`, async () => {
      const res = await app.inject({
        method: w.method,
        url: `${base}/victim/${w.path}`,
        payload: w.payload,
      });
      expect(res.statusCode).toBe(404);
    });

    it(`${w.method} ${w.path}: 403 for a viewer, nothing written`, async () => {
      modelGrants.set("m1", { role: "VIEWER" });
      const res = await app.inject({
        method: w.method,
        url: `${base}/m1/${w.path}`,
        payload: w.payload,
      });
      expect(res.statusCode).toBe(403);
      expect(mockPrisma.controlImplementation.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.controlImplementation.update).not.toHaveBeenCalled();
      expect(mockPrisma.controlEvidence.create).not.toHaveBeenCalled();
    });

    it(`${w.method} ${w.path}: succeeds for an editor`, async () => {
      modelGrants.set("m1", { role: "EDITOR" });
      const res = await app.inject({
        method: w.method,
        url: `${base}/m1/${w.path}`,
        payload: w.payload,
      });
      expect(res.statusCode).toBeLessThan(300);
    });
  }

  describe("DELETE evidence", () => {
    const url = "/api/compliance-evidence/evidence/ev1";

    it("authorizes against the owning model: 404 without access", async () => {
      const res = await app.inject({ method: "DELETE", url });
      expect(res.statusCode).toBe(404);
      expect(mockPrisma.controlEvidence.delete).not.toHaveBeenCalled();
    });

    it("returns 404 for unknown evidence", async () => {
      mockPrisma.controlEvidence.findUnique.mockResolvedValue(null);
      const res = await app.inject({ method: "DELETE", url });
      expect(res.statusCode).toBe(404);
      expect(mockPrisma.controlEvidence.delete).not.toHaveBeenCalled();
    });

    it("returns 403 for an editor (needs delete permission)", async () => {
      modelGrants.set("victim", { role: "EDITOR" });
      const res = await app.inject({ method: "DELETE", url });
      expect(res.statusCode).toBe(403);
      expect(mockPrisma.controlEvidence.delete).not.toHaveBeenCalled();
    });

    it("deletes for an admin", async () => {
      modelGrants.set("victim", { role: "ADMIN" });
      const res = await app.inject({ method: "DELETE", url });
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.controlEvidence.delete).toHaveBeenCalledWith({
        where: { id: "ev1" },
      });
    });
  });

  it("PUT: 400 when ownerId is not an active org member", async () => {
    modelGrants.set("m1", { role: "EDITOR", organizationId: "o1" });
    orgUserRoles.set("o1:alice", "EDITOR");
    const url = `${base}/m1/compliance-evidence/HIPAA/AC-1`;

    const bad = await app.inject({
      method: "PUT",
      url,
      payload: { ownerId: "outsider" },
    });
    expect(bad.statusCode).toBe(400);
    expect(mockPrisma.controlImplementation.upsert).not.toHaveBeenCalled();

    const ok = await app.inject({
      method: "PUT",
      url,
      payload: { ownerId: "alice" },
    });
    expect(ok.statusCode).toBe(200);
  });
});
