/**
 * The IaC/tool/YAML import routes trusted a body `projectId` without any
 * check, so any signed-in user could create a threat model inside another
 * tenant's project. The project must be one the caller is an ACTIVE member of.
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
  project: { findFirst: vi.fn() },
  threatModel: { create: vi.fn() },
  threat: { createMany: vi.fn(), create: vi.fn() },
  mitigation: { create: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("../../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../../../services/audit.js", () => ({
  logAudit: vi.fn(() => Promise.resolve()),
}));

vi.mock(
  "../../../../services/access-control/access-control-service.js",
  async () =>
    (await import("../../../../test/helpers/access-control-mock.js"))
      .accessControlModule,
);

const { projectGrants, resetGrants } = await import(
  "../../../../test/helpers/access-control-mock.js"
);
const { exportImportRoutes } = await import("../export-import.js");

const terraform = `resource "aws_s3_bucket" "b" {\n  bucket = "x"\n}\n`;
const yaml = 'name: "Imported"\n';

const routes = [
  {
    url: "/api/threat-models/import/terraform",
    payload: { content: terraform },
  },
  { url: "/api/threat-models/import/yaml", payload: { content: yaml } },
];

describe("threat model import: projectId must be the caller's", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(exportImportRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    resetGrants();
    projectGrants.set("p-own", { role: "EDITOR", organizationId: "o1" });
    // The caller is a member of p-own only.
    mockPrisma.project.findFirst.mockImplementation(
      async ({ where }: { where: { id?: string } }) =>
        where.id === undefined || where.id === "p-own" ? { id: "p-own" } : null,
    );
    mockPrisma.threatModel.create.mockImplementation(async ({ data }) => ({
      id: "m-new",
      ...data,
    }));
  });

  for (const r of routes) {
    it(`${r.url}: another tenant's project is 404 and nothing is created`, async () => {
      const res = await app.inject({
        method: "POST",
        url: r.url,
        payload: { ...r.payload, projectId: "p-victim" },
      });
      expect(res.statusCode).toBe(404);
      expect(mockPrisma.threatModel.create).not.toHaveBeenCalled();
    });

    it(`${r.url}: the caller's own project is accepted`, async () => {
      const res = await app.inject({
        method: "POST",
        url: r.url,
        payload: { ...r.payload, projectId: "p-own" },
      });
      expect(res.statusCode).toBe(201);
      expect(mockPrisma.threatModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ projectId: "p-own" }),
        }),
      );
    });
  }
});
