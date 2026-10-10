/**
 * gap-analysis, scan-code and scan-from-github used to call
 * canAccessThreatModel and throw the boolean away, so any signed-in user
 * could read another org's gap analysis or write mitigations into its model.
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
  threat: { findMany: vi.fn(), findFirst: vi.fn() },
  mitigation: { findMany: vi.fn(), create: vi.fn() },
  document: { create: vi.fn() },
  $transaction: vi.fn(),
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
const { gapAnalysisRoutes } = await import("../gap-analysis.js");
const { scanCodeRoutes } = await import("../scan-code.js");
const { scanFromGithubRoutes } = await import("../scan-from-github.js");

const fetchMock = vi.fn();

describe("gap-analysis / scan routes authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    vi.stubGlobal("fetch", fetchMock);
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(gapAnalysisRoutes);
    await app.register(scanCodeRoutes);
    await app.register(scanFromGithubRoutes);
    await app.ready();
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetGrants();
    mockPrisma.threat.findMany.mockResolvedValue([]);
    mockPrisma.threat.findFirst.mockResolvedValue({ id: "t1" });
    mockPrisma.mitigation.findMany.mockResolvedValue([]);
    fetchMock.mockRejectedValue(new Error("network disabled in test"));
  });

  const scanCodeBody = {
    threatId: "t1",
    files: [{ path: "src/a.ts", content: "const x = 1;" }],
  };

  describe("GET gap-analysis", () => {
    it("returns 404 and reads nothing when the caller has no access", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/threat-models/victim/gap-analysis",
      });
      expect(res.statusCode).toBe(404);
      expect(mockPrisma.threat.findMany).not.toHaveBeenCalled();
    });

    it("allows a viewer", async () => {
      modelGrants.set("m1", { role: "VIEWER" });
      const res = await app.inject({
        method: "GET",
        url: "/api/threat-models/m1/gap-analysis",
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST scan-code", () => {
    it("returns 404 when the caller has no access", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/threat-models/victim/scan-code",
        payload: scanCodeBody,
      });
      expect(res.statusCode).toBe(404);
      expect(mockPrisma.threat.findFirst).not.toHaveBeenCalled();
    });

    it("returns 403 for a viewer (scan writes mitigations)", async () => {
      modelGrants.set("m1", { role: "VIEWER" });
      const res = await app.inject({
        method: "POST",
        url: "/api/threat-models/m1/scan-code",
        payload: scanCodeBody,
      });
      expect(res.statusCode).toBe(403);
      expect(mockPrisma.threat.findFirst).not.toHaveBeenCalled();
    });

    it("lets an editor through", async () => {
      modelGrants.set("m1", { role: "EDITOR" });
      const res = await app.inject({
        method: "POST",
        url: "/api/threat-models/m1/scan-code",
        payload: scanCodeBody,
      });
      expect(res.statusCode).toBe(200);
      expect(mockPrisma.threat.findFirst).toHaveBeenCalled();
    });
  });

  describe("POST scan-from-github", () => {
    const payload = { owner: "acme", repo: "app" };

    it("returns 404 when the caller has no access", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/threat-models/victim/scan-from-github",
        payload,
      });
      expect(res.statusCode).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns 403 for a guest viewer", async () => {
      modelGrants.set("m1", { role: "VIEWER", guest: true });
      const res = await app.inject({
        method: "POST",
        url: "/api/threat-models/m1/scan-from-github",
        payload,
      });
      expect(res.statusCode).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("lets a guest editor through to GitHub", async () => {
      modelGrants.set("m1", { role: "EDITOR", guest: true });
      await app.inject({
        method: "POST",
        url: "/api/threat-models/m1/scan-from-github",
        payload,
      });
      expect(fetchMock).toHaveBeenCalled();
    });
  });
});
