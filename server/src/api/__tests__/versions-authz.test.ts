/**
 * Version writes (create, restore, rename) only required view access, so a
 * viewer or guest viewer could roll a model back to any snapshot. The diff
 * loaded both versions by id alone, so a caller with access to one model
 * could read another tenant's snapshot by passing its version id.
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

let prisma = createFakePrisma({});

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(prisma)),
}));
vi.mock("../../services/canvas-sync.js", () => ({
  syncCanvasToDatabase: vi.fn(),
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
const { versionRoutes } = await import("../versions.js");

const canvas = JSON.stringify({ nodes: [], edges: [] });

describe("version routes authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(versionRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    resetGrants();
    prisma = createFakePrisma({
      threatModel: [{ id: "m1", canvasState: canvas }],
      threatModelVersion: [
        {
          id: "v1",
          threatModelId: "m1",
          version: 1,
          canvasState: canvas,
          createdById: "caller",
          createdAt: new Date(),
        },
        {
          id: "v-victim",
          threatModelId: "victim",
          version: 1,
          canvasState: JSON.stringify({
            nodes: [{ id: "n", type: "component", data: { label: "Secret" } }],
          }),
          createdById: "other",
          createdAt: new Date(),
        },
      ],
      document: [],
      user: [],
      threat: [],
    });
    prisma.threatModelVersion.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "v-new",
        createdAt: new Date(),
        ...data,
      }),
    );
    prisma.threatModelVersion.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "v1",
        version: 1,
        createdById: "caller",
        createdAt: new Date(),
        ...data,
      }),
    );
  });

  const writes = [
    { method: "POST" as const, url: "/api/threat-models/m1/versions" },
    {
      method: "POST" as const,
      url: "/api/threat-models/m1/versions/v1/restore",
    },
    { method: "PATCH" as const, url: "/api/threat-models/m1/versions/v1" },
  ];

  for (const w of writes) {
    it(`${w.method} ${w.url}: 403 for a viewer, nothing written`, async () => {
      modelGrants.set("m1", { role: "VIEWER" });
      const res = await app.inject({
        method: w.method,
        url: w.url,
        payload: { changesSummary: "x" },
      });
      expect(res.statusCode).toBe(403);
      expect(prisma.threatModelVersion.create).not.toHaveBeenCalled();
      expect(prisma.threatModelVersion.update).not.toHaveBeenCalled();
      expect(prisma.threatModel.update).not.toHaveBeenCalled();
    });

    it(`${w.method} ${w.url}: 403 for a guest viewer`, async () => {
      modelGrants.set("m1", { role: "VIEWER", guest: true });
      const res = await app.inject({
        method: w.method,
        url: w.url,
        payload: { changesSummary: "x" },
      });
      expect(res.statusCode).toBe(403);
    });

    it(`${w.method} ${w.url}: allowed for an editor`, async () => {
      modelGrants.set("m1", { role: "EDITOR" });
      const res = await app.inject({
        method: w.method,
        url: w.url,
        payload: { changesSummary: "x" },
      });
      expect(res.statusCode).toBeLessThan(300);
    });
  }

  it("diff refuses a version that belongs to another model", async () => {
    modelGrants.set("m1", { role: "VIEWER" });
    const res = await app.inject({
      method: "GET",
      url: "/api/threat-models/m1/versions/diff?from=v1&to=v-victim",
    });
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain("Secret");
  });

  it("diff works for two versions of the same model", async () => {
    modelGrants.set("m1", { role: "VIEWER" });
    const res = await app.inject({
      method: "GET",
      url: "/api/threat-models/m1/versions/diff?from=v1&to=v1",
    });
    expect(res.statusCode).toBe(200);
  });
});
