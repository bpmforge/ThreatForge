/**
 * /metrics (platform-wide request, auth and business counters) and
 * /health/dependencies (DB provider, missing env var names, raw connection
 * errors) were open to anyone. Both now need `Authorization: Bearer
 * $METRICS_TOKEN` and are off (404) when METRICS_TOKEN is unset. /health,
 * /health/live and /health/ready stay public for probes and smoke tests.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

vi.mock("../../services/observability/index.js", () => ({
  exportMetrics: () => "m 1",
  runHealthChecks: async () => ({ status: "healthy" }),
  runLivenessCheck: async () => ({ ok: true }),
  runReadinessCheck: async () => ({ ready: true }),
  runDependencyCheck: async () => ({ ready: true }),
  getSystemInfo: () => ({}),
}));

const { observabilityRoutes } = await import("../observability.js");

describe("observability endpoints", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = Fastify();
    await app.register(observabilityRoutes);
    await app.ready();
  });
  afterAll(() => app.close());
  afterEach(() => vi.unstubAllEnvs());

  const get = (url: string, token?: string) =>
    app.inject({
      method: "GET",
      url,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  for (const url of ["/metrics", "/health/dependencies"]) {
    it(`${url}: 404 when METRICS_TOKEN is unset`, async () => {
      vi.stubEnv("METRICS_TOKEN", "");
      expect((await get(url)).statusCode).toBe(404);
    });

    it(`${url}: 401 without the token, 200 with it`, async () => {
      vi.stubEnv("METRICS_TOKEN", "s3cret-metrics");
      expect((await get(url)).statusCode).toBe(401);
      expect((await get(url, "wrong")).statusCode).toBe(401);
      expect((await get(url, "s3cret-metrics")).statusCode).toBe(200);
    });
  }

  it("/health/ready stays public", async () => {
    expect((await get("/health/ready")).statusCode).toBe(200);
  });
});
