/**
 * Document, requirement, requirement-import and findings-import writes only
 * checked that the caller could see the model, so a viewer or guest viewer
 * could add, change and delete them. Writes need edit.
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

// Some route modules capture getPrisma() at registration, so keep one instance.
const prisma = createFakePrisma({
  threatModel: [{ id: "m1" }],
  document: [{ id: "doc1", threatModelId: "m1" }],
  requirement: [{ id: "req1", threatModelId: "m1" }],
});

vi.mock("../../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(prisma)),
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
const { documentsRoutes } = await import("../documents.js");
const { requirementsRoutes } = await import("../requirements.js");
const { requirementsImportRoutes } = await import("../requirements-import.js");
const { findingsImportRoutes } = await import("../findings-import.js");

const m = "/api/threat-models/m1";
const writes = [
  {
    method: "POST",
    url: `${m}/documents`,
    payload: { name: "d", content: "c" },
  },
  { method: "DELETE", url: `${m}/documents/doc1` },
  { method: "POST", url: `${m}/requirements`, payload: { title: "r" } },
  { method: "PATCH", url: `${m}/requirements/req1`, payload: { title: "r2" } },
  { method: "DELETE", url: `${m}/requirements/req1` },
  {
    method: "POST",
    url: `${m}/requirements/bulk`,
    payload: { requirements: [] },
  },
  {
    method: "POST",
    url: `${m}/requirements/import/csv`,
    payload: "title\nr",
    headers: { "content-type": "text/plain" },
  },
  { method: "POST", url: `${m}/requirements/import/framework`, payload: {} },
  {
    method: "POST",
    url: `${m}/import-findings`,
    payload: "{}",
    headers: { "content-type": "text/plain" },
  },
] as const;

describe("model content writes need edit", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addContentTypeParser(
      "text/plain",
      { parseAs: "string" },
      (_req, body, done) => done(null, body),
    );
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(documentsRoutes);
    await app.register(requirementsRoutes);
    await app.register(requirementsImportRoutes);
    await app.register(findingsImportRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    resetGrants();
    vi.clearAllMocks();
  });

  const wrote = () =>
    ["document", "requirement", "threat", "mitigation"].some((t) =>
      ["create", "update", "delete", "createMany", "deleteMany", "upsert"].some(
        (op) =>
          (prisma[t] as Record<string, { mock?: { calls: unknown[] } }>)[op]
            ?.mock?.calls.length,
      ),
    );

  for (const w of writes) {
    it(`${w.method} ${w.url}: 403 for a viewer and a guest viewer`, async () => {
      for (const grant of [
        { role: "VIEWER" as const },
        { role: "VIEWER" as const, guest: true },
      ]) {
        modelGrants.set("m1", grant);
        const res = await app.inject({ ...w });
        expect(res.statusCode).toBe(403);
      }
      expect(wrote()).toBe(false);
    });

    it(`${w.method} ${w.url}: 404 without access`, async () => {
      const res = await app.inject({ ...w });
      expect(res.statusCode).toBe(404);
    });
  }
});
