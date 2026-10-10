/**
 * Scanner results authorization: finding ids must belong to the project in
 * the URL, mapped components to a model of that project, and auto-map only
 * touches findings of the model's own project. Scans, imports, status changes
 * and mappings are writes: an org VIEWER gets 403 (they used to be allowed
 * for any member).
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
import { createFakePrisma } from "../../../test/helpers/fake-prisma.js";

const prisma = createFakePrisma(
  {
    threatModel: [
      {
        id: "m-a",
        projectId: "p-a",
        project: { organization: { memberships: [{ role: "OWNER" }] } },
      },
      { id: "m-b", projectId: "p-b" },
    ],
    component: [
      { id: "c-a", threatModelId: "m-a" },
      { id: "c-b", threatModelId: "m-b" },
    ],
    scannerFinding: [
      { id: "f-a", projectId: "p-a", externalId: "ext-a" },
      { id: "f-b", projectId: "p-b", externalId: "ext-shared" },
    ],
  },
  { component: { threatModel: ["threatModel", "threatModelId"] } },
);

const mapFindingsToComponents = vi.fn();
const mockRunSnykScan = vi.fn(async () => []);

vi.mock("../../../db.js", () => ({ getPrisma: vi.fn(async () => prisma) }));
vi.mock(
  "../../../services/access-control/access-control-service.js",
  async () =>
    (await import("../../../test/helpers/access-control-mock.js"))
      .accessControlModule,
);
vi.mock("../../../services/security-scanners/index.js", () => ({
  runSnykScan: mockRunSnykScan,
  persistScanResults: vi.fn(async () => ({ id: "run" })),
  runSonarQubeScan: vi.fn(),
  importZapScan: vi.fn(),
  getProjectFindings: vi.fn(async () => []),
  getScanHistory: vi.fn(async () => []),
  getFindingStats: vi.fn(async () => ({})),
  mapFindingsToComponents: (...a: unknown[]) => mapFindingsToComponents(...a),
}));

const { modelGrants, projectGrants, resetGrants } = await import(
  "../../../test/helpers/access-control-mock.js"
);
const { scannerResultsRoutes } = await import("../routes/results.js");
const { scannerConfigurationRoutes } = await import(
  "../routes/configuration.js"
);

/** u1 holds `role` in org A (project p-a, model m-a); nothing elsewhere. */
function grant(role: "OWNER" | "VIEWER") {
  resetGrants();
  projectGrants.set("p-a", { role });
  modelGrants.set("m-a", { role });
}

describe("scanner results authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "u1", email: "u1@x.test", name: "U1" };
    });
    await app.register(scannerResultsRoutes);
    await app.register(scannerConfigurationRoutes);
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => {
    vi.clearAllMocks();
    grant("OWNER");
  });

  it("does not update the status of another project's finding", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/projects/p-a/scanners/findings/f-b/status",
      payload: { status: "DISMISSED" },
    });
    expect(res.statusCode).toBe(404);
    expect(prisma.scannerFinding.update).not.toHaveBeenCalled();
  });

  it("does not map another project's finding", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects/p-a/scanners/findings/f-b/map",
      payload: { componentId: "c-a", confidence: "HIGH" },
    });
    expect(res.statusCode).toBe(404);
    expect(prisma.findingComponentMap.upsert).not.toHaveBeenCalled();
  });

  it("does not map a finding to another project's component", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects/p-a/scanners/findings/f-a/map",
      payload: { componentId: "c-b", confidence: "HIGH" },
    });
    expect(res.statusCode).toBe(404);
    expect(prisma.findingComponentMap.upsert).not.toHaveBeenCalled();
  });

  it("maps a project finding to a component of that project", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects/p-a/scanners/findings/f-a/map",
      payload: { componentId: "c-a", confidence: "HIGH" },
    });
    expect(res.statusCode).toBe(200);
    expect(prisma.findingComponentMap.upsert).toHaveBeenCalledOnce();
  });

  it("auto-map does not attach findings from another project", async () => {
    mapFindingsToComponents.mockResolvedValue([
      {
        findingId: "ext-shared",
        componentId: "c-a",
        confidence: "HIGH",
        mappingReason: "x",
      },
    ]);
    const res = await app.inject({
      method: "POST",
      url: "/api/threat-models/m-a/scanners/auto-map",
    });
    expect(res.statusCode).toBe(200);
    expect(prisma.findingComponentMap.upsert).not.toHaveBeenCalled();
  });

  it("auto-map attaches the project's own findings", async () => {
    mapFindingsToComponents.mockResolvedValue([
      {
        findingId: "ext-a",
        componentId: "c-a",
        confidence: "HIGH",
        mappingReason: "x",
      },
    ]);
    const res = await app.inject({
      method: "POST",
      url: "/api/threat-models/m-a/scanners/auto-map",
    });
    expect(res.statusCode).toBe(200);
    expect(prisma.findingComponentMap.upsert).toHaveBeenCalledOnce();
  });

  describe("an org VIEWER", () => {
    beforeEach(() => grant("VIEWER"));

    const writes = [
      {
        method: "PATCH",
        url: "/api/projects/p-a/scanners/findings/f-a/status",
        payload: { status: "DISMISSED" },
      },
      {
        method: "POST",
        url: "/api/projects/p-a/scanners/findings/f-a/map",
        payload: { componentId: "c-a", confidence: "HIGH" },
      },
      { method: "POST", url: "/api/threat-models/m-a/scanners/auto-map" },
      {
        method: "POST",
        url: "/api/projects/p-a/scanners/snyk/scan",
        payload: { token: "t", orgId: "o" },
      },
      {
        method: "POST",
        url: "/api/projects/p-a/scanners/zap/import",
        payload: { report: "{}" },
      },
    ] as const;

    for (const w of writes) {
      it(`gets 403 on ${w.method} ${w.url}`, async () => {
        const res = await app.inject({ ...w });
        expect(res.statusCode).toBe(403);
        expect(prisma.scannerFinding.update).not.toHaveBeenCalled();
        expect(prisma.findingComponentMap.upsert).not.toHaveBeenCalled();
      });
    }

    it("can still read findings", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/projects/p-a/scanners/findings",
      });
      expect(res.statusCode).toBe(200);
    });
  });

  it("another org's project is a 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/projects/p-b/scanners/findings",
    });
    expect(res.statusCode).toBe(404);
  });

  it("a scan cannot attach results to another project's threat model", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects/p-a/scanners/snyk/scan",
      payload: { snykProjectId: "s", apiKey: "k", threatModelId: "m-b" },
    });
    expect(res.statusCode).toBe(404);
    expect(mockRunSnykScan).not.toHaveBeenCalled();
  });
});
