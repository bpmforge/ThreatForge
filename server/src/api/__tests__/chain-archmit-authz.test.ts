/**
 * Attack-chain and architectural-mitigation writes only checked view access,
 * so a viewer or guest viewer could create, change, delete and (with AI spend)
 * analyze. Writes need edit; no access is a 404 like a missing model.
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
vi.mock(
  "../../services/access-control/access-control-service.js",
  async () =>
    (await import("../../test/helpers/access-control-mock.js"))
      .accessControlModule,
);
vi.mock("../../services/ai/spend-guard.js", async (orig) => ({
  ...(await orig<typeof import("../../services/ai/spend-guard.js")>()),
  assertWithinSpendCap: vi.fn(),
}));
vi.mock("../../jobs/ai-queue.js", () => ({
  enqueueAiJob: vi.fn(),
  runJobInBackground: vi.fn(),
}));

const { modelGrants, resetGrants } = await import(
  "../../test/helpers/access-control-mock.js"
);
const { attackChainRoutes } = await import("../attack-chains.js");
const { architecturalMitigationRoutes } = await import(
  "../architectural-mitigations.js"
);

const chainBody = {
  name: "c",
  description: "d",
  severity: "HIGH",
  sessionId: "s",
  entryPointId: "e",
  entryPointName: "E",
  targetAssetId: "t",
  targetAssetName: "T",
  hops: [
    {
      position: 0,
      componentId: "c1",
      componentName: "C1",
      description: "h",
      preconditions: [],
      yields: [],
    },
  ],
};
const mitBody = {
  kind: "ADD_CONTROL",
  title: "t",
  proposedChange: "p",
};

const chains = "/api/threat-models/m1/attack-chains";
const mits = "/api/threat-models/m1/architectural-mitigations";
const writes = [
  { method: "POST" as const, url: `${chains}/analyze`, payload: {} },
  { method: "POST" as const, url: chains, payload: chainBody },
  {
    method: "PATCH" as const,
    url: `${chains}/ch1`,
    payload: { status: "ACCEPTED" },
  },
  { method: "DELETE" as const, url: `${chains}/ch1`, payload: undefined },
  { method: "POST" as const, url: `${mits}/analyze`, payload: {} },
  { method: "POST" as const, url: mits, payload: mitBody },
  { method: "PATCH" as const, url: `${mits}/am1`, payload: { title: "x" } },
  { method: "DELETE" as const, url: `${mits}/am1`, payload: undefined },
];

describe("attack chain / architectural mitigation write authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(attackChainRoutes);
    await app.register(architecturalMitigationRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    resetGrants();
    prisma = createFakePrisma({
      threatModel: [{ id: "m1", project: { organizationId: "o1" } }],
      attackChain: [{ id: "ch1", threatModelId: "m1" }],
      architecturalMitigation: [{ id: "am1", threatModelId: "m1" }],
      aiJob: [],
    });
  });

  const written = () =>
    [
      prisma.attackChain.create,
      prisma.attackChain.update,
      prisma.attackChain.delete,
      prisma.architecturalMitigation.create,
      prisma.architecturalMitigation.update,
      prisma.architecturalMitigation.delete,
      prisma.aiJob.create,
    ].some((fn) => fn.mock.calls.length > 0);

  for (const w of writes) {
    it(`${w.method} ${w.url}: 404 without access`, async () => {
      const res = await app.inject({ ...w });
      expect(res.statusCode).toBe(404);
      expect(written()).toBe(false);
    });

    it(`${w.method} ${w.url}: 403 for a viewer and a guest viewer`, async () => {
      for (const grant of [
        { role: "VIEWER" as const },
        { role: "VIEWER" as const, guest: true },
      ]) {
        modelGrants.set("m1", grant);
        const res = await app.inject({ ...w });
        expect(res.statusCode).toBe(403);
      }
      expect(written()).toBe(false);
    });

    it(`${w.method} ${w.url}: an editor gets past authorization`, async () => {
      modelGrants.set("m1", { role: "EDITOR", organizationId: "o1" });
      const res = await app.inject({ ...w });
      expect([403, 404]).not.toContain(res.statusCode);
    });
  }

  it("reads stay open to a viewer", async () => {
    modelGrants.set("m1", { role: "VIEWER" });
    expect((await app.inject({ method: "GET", url: chains })).statusCode).toBe(
      200,
    );
    expect((await app.inject({ method: "GET", url: mits })).statusCode).toBe(
      200,
    );
  });
});
