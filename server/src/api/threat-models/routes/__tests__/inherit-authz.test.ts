/**
 * set-parent / inherit-threats checked authentication only: any signed-in
 * user could re-parent any model and copy another org's threats into it.
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
  threatModel: { findFirst: vi.fn() },
  threat: { findMany: vi.fn(), create: vi.fn() },
  $executeRawUnsafe: vi.fn(),
  $queryRawUnsafe: vi.fn(),
};

vi.mock("../../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock(
  "../../../../services/access-control/access-control-service.js",
  async () =>
    (await import("../../../../test/helpers/access-control-mock.js"))
      .accessControlModule,
);

const { modelGrants, resetGrants } = await import(
  "../../../../test/helpers/access-control-mock.js"
);
const { inheritRoutes } = await import("../inherit.js");

describe("inherit routes authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(inheritRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    resetGrants();
    mockPrisma.threatModel.findFirst.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        name: `model ${where.id}`,
        threats: [{ name: "Leaked secret", severity: "HIGH" }],
      }),
    );
    mockPrisma.threat.findMany.mockResolvedValue([]);
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      { parentModelId: "victim-parent" },
    ]);
  });

  const setParent = (id: string, parentModelId: string | null) =>
    app.inject({
      method: "POST",
      url: `/api/threat-models/${id}/set-parent`,
      payload: { parentModelId },
    });
  const inherit = (id: string) =>
    app.inject({
      method: "POST",
      url: `/api/threat-models/${id}/inherit-threats`,
    });

  describe("set-parent", () => {
    it("returns 404 when the caller cannot see :id", async () => {
      const res = await setParent("victim", null);
      expect(res.statusCode).toBe(404);
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it("returns 403 for a viewer of :id", async () => {
      modelGrants.set("m1", { role: "VIEWER" });
      const res = await setParent("m1", null);
      expect(res.statusCode).toBe(403);
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it("returns 404 when the caller cannot see the parent", async () => {
      modelGrants.set("m1", { role: "EDITOR" });
      const res = await setParent("m1", "victim-parent");
      expect(res.statusCode).toBe(404);
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it("lets an editor set a parent they can view", async () => {
      modelGrants.set("m1", { role: "EDITOR" });
      modelGrants.set("p1", { role: "VIEWER" });
      const res = await setParent("m1", "p1");
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalled();
    });
  });

  describe("inherit-threats", () => {
    it("returns 404 when the caller cannot see :id", async () => {
      const res = await inherit("victim");
      expect(res.statusCode).toBe(404);
      expect(mockPrisma.threat.create).not.toHaveBeenCalled();
    });

    it("returns 403 for a viewer of :id", async () => {
      modelGrants.set("m1", { role: "VIEWER" });
      const res = await inherit("m1");
      expect(res.statusCode).toBe(403);
      expect(mockPrisma.threat.create).not.toHaveBeenCalled();
    });

    it("returns 404 when the stored parent is no longer visible", async () => {
      modelGrants.set("m1", { role: "EDITOR" });
      const res = await inherit("m1");
      expect(res.statusCode).toBe(404);
      expect(mockPrisma.threat.create).not.toHaveBeenCalled();
    });

    it("copies threats for an editor who can view the parent", async () => {
      modelGrants.set("m1", { role: "EDITOR" });
      modelGrants.set("victim-parent", { role: "VIEWER" });
      const res = await inherit("m1");
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.threat.create).toHaveBeenCalledTimes(1);
    });
  });
});
