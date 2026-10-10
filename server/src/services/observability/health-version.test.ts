/**
 * /health tells which build is running: the package version (it always said
 * "1.0.0" because npm_package_version is unset under `node dist/index.js`)
 * and the git commit baked in at build time (GIT_SHA), so a deploy can check
 * the new code is really serving.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(async () => ({ $queryRaw: vi.fn(async () => [1]) })),
  getPoolMetrics: vi.fn(() => null),
}));
vi.mock("../redis-collaboration.js", () => ({ isRedisEnabled: () => false }));

const { runHealthChecks } = await import("./health.js");

describe("build identity on /health", () => {
  it("reports the package version and the deployed commit", async () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
    ) as { version: string };
    process.env.GIT_SHA = "abc1234";
    try {
      const result = await runHealthChecks();
      expect(result.version).toBe(pkg.version);
      expect(result.commit).toBe("abc1234");
    } finally {
      delete process.env.GIT_SHA;
    }
  });

  it("says unknown when no commit was baked in", async () => {
    delete process.env.GIT_SHA;
    expect((await runHealthChecks()).commit).toBe("unknown");
  });
});
