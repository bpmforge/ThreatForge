/**
 * Public share links only required view access: a guest viewer could mint
 * an unauthenticated link to the whole model (ignoring the org's
 * allowGuestAccess switch), and DELETE removed any ModelAccess row of the
 * model, including real guest grants. Minting and revoking now need an org
 * member with edit, minting respects allowGuestAccess, and DELETE only
 * touches public-share rows.
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
  threatModel: { findUnique: vi.fn() },
  modelAccess: { create: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../services/audit.js", () => ({
  logAudit: vi.fn(() => Promise.resolve()),
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
const { publicShareRoutes } = await import("../public-share.js");

describe("public share authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(publicShareRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  let allowGuestAccess = true;
  beforeEach(() => {
    vi.clearAllMocks();
    resetGrants();
    allowGuestAccess = true;
    mockPrisma.threatModel.findUnique.mockImplementation(async () => ({
      id: "m1",
      project: { organizationId: "o1", organization: { allowGuestAccess } },
    }));
    mockPrisma.modelAccess.create.mockResolvedValue({ id: "share-1" });
    mockPrisma.modelAccess.deleteMany.mockResolvedValue({ count: 1 });
  });

  const mint = () =>
    app.inject({ method: "POST", url: "/api/threat-models/m1/share" });

  it("POST: 403 for a guest viewer, nothing minted", async () => {
    modelGrants.set("m1", { role: "VIEWER", guest: true });
    expect((await mint()).statusCode).toBe(403);
    expect(mockPrisma.modelAccess.create).not.toHaveBeenCalled();
  });

  it("POST: 403 for a guest editor (guests cannot re-share)", async () => {
    modelGrants.set("m1", { role: "EDITOR", guest: true });
    expect((await mint()).statusCode).toBe(403);
    expect(mockPrisma.modelAccess.create).not.toHaveBeenCalled();
  });

  it("POST: 403 for an org viewer", async () => {
    modelGrants.set("m1", { role: "VIEWER" });
    expect((await mint()).statusCode).toBe(403);
  });

  it("POST: 403 when the org disallows guest access", async () => {
    modelGrants.set("m1", { role: "EDITOR" });
    allowGuestAccess = false;
    expect((await mint()).statusCode).toBe(403);
    expect(mockPrisma.modelAccess.create).not.toHaveBeenCalled();
  });

  it("POST: an org editor can mint a link", async () => {
    modelGrants.set("m1", { role: "EDITOR" });
    expect((await mint()).statusCode).toBe(201);
  });

  it("DELETE: 403 for a guest viewer, nothing removed", async () => {
    modelGrants.set("m1", { role: "VIEWER", guest: true });
    const res = await app.inject({
      method: "DELETE",
      url: "/api/threat-models/m1/share/grant-1",
    });
    expect(res.statusCode).toBe(403);
    expect(mockPrisma.modelAccess.deleteMany).not.toHaveBeenCalled();
  });

  it("DELETE: only public-share rows can be removed", async () => {
    modelGrants.set("m1", { role: "EDITOR" });
    const res = await app.inject({
      method: "DELETE",
      url: "/api/threat-models/m1/share/grant-1",
    });
    expect(res.statusCode).toBe(204);
    const where = mockPrisma.modelAccess.deleteMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      id: "grant-1",
      threatModelId: "m1",
      userId: null,
    });
    expect(JSON.stringify(where)).toContain("gst_");
  });
});
