/**
 * Citation routes checked access to the model in the URL but then read and
 * wrote citations by threat / mitigation id alone, so access to one model
 * exposed (and let a viewer override) another tenant's citations. Overrides
 * and batch verification are writes and need edit.
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
vi.mock("../../jobs/ai-queue.js", () => ({ enqueueAiJob: vi.fn() }));
vi.mock("../../services/ai/spend-guard.js", () => ({
  replyIfOverSpendCap: vi.fn(async () => false),
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
const { citationRoutes } = await import("../citations.js");

const base = "/api/threat-models/m1";

describe("citation routes authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(citationRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    resetGrants();
    prisma = createFakePrisma(
      {
        threatModel: [{ id: "m1", project: { organization: { id: "o1" } } }],
        threat: [
          { id: "t1", threatModelId: "m1" },
          { id: "t-victim", threatModelId: "victim" },
        ],
        mitigation: [
          { id: "mit1", threatId: "t1" },
          { id: "mit-victim", threatId: "t-victim" },
        ],
        citation: [
          { id: "c1", threatId: "t1", excerpt: "mine" },
          { id: "c-victim", threatId: "t-victim", excerpt: "SECRET" },
          { id: "cm-victim", mitigationId: "mit-victim", excerpt: "SECRET" },
        ],
        aiJob: [],
      },
      { mitigation: { threat: ["threat", "threatId"] } },
    );
  });

  it("GET threat citations: another model's threat is a 404", async () => {
    modelGrants.set("m1", { role: "VIEWER" });
    const res = await app.inject({
      method: "GET",
      url: `${base}/threats/t-victim/citations`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain("SECRET");
  });

  it("GET mitigation citations: another model's mitigation is a 404", async () => {
    modelGrants.set("m1", { role: "VIEWER" });
    const res = await app.inject({
      method: "GET",
      url: `${base}/mitigations/mit-victim/citations`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain("SECRET");
  });

  it("GET threat citations: own threat is readable by a viewer", async () => {
    modelGrants.set("m1", { role: "VIEWER" });
    const res = await app.inject({
      method: "GET",
      url: `${base}/threats/t1/citations`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("mine");
  });

  const override = { status: "VERIFIED" };

  it("PATCH threat citation: 403 for a viewer", async () => {
    modelGrants.set("m1", { role: "VIEWER" });
    const res = await app.inject({
      method: "PATCH",
      url: `${base}/threats/t1/citations/c1`,
      payload: override,
    });
    expect(res.statusCode).toBe(403);
    expect(prisma.citation.update).not.toHaveBeenCalled();
  });

  it("PATCH threat citation: an editor cannot reach another model's threat", async () => {
    modelGrants.set("m1", { role: "EDITOR" });
    const res = await app.inject({
      method: "PATCH",
      url: `${base}/threats/t-victim/citations/c-victim`,
      payload: override,
    });
    expect(res.statusCode).toBe(404);
    expect(prisma.citation.update).not.toHaveBeenCalled();
  });

  it("PATCH mitigation citation: an editor cannot reach another model's mitigation", async () => {
    modelGrants.set("m1", { role: "EDITOR" });
    const res = await app.inject({
      method: "PATCH",
      url: `${base}/mitigations/mit-victim/citations/cm-victim`,
      payload: override,
    });
    expect(res.statusCode).toBe(404);
    expect(prisma.citation.update).not.toHaveBeenCalled();
  });

  it("PATCH threat citation: allowed for an editor on their own model", async () => {
    modelGrants.set("m1", { role: "EDITOR" });
    const res = await app.inject({
      method: "PATCH",
      url: `${base}/threats/t1/citations/c1`,
      payload: override,
    });
    expect(res.statusCode).toBe(200);
  });

  it("POST verify-batch: 403 for a guest viewer", async () => {
    modelGrants.set("m1", { role: "VIEWER", guest: true });
    const res = await app.inject({
      method: "POST",
      url: `${base}/citations/verify-batch`,
    });
    expect(res.statusCode).toBe(403);
    expect(prisma.aiJob.create).not.toHaveBeenCalled();
  });
});
