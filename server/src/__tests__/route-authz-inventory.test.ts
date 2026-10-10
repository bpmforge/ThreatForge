/**
 * Route Authorization Inventory
 *
 * Builds the real Fastify app (no listen, no database), records every route
 * through an onRoute hook, and fails when a route does not declare who may
 * call it via `config: { authz: ... }` (see src/middleware/authz-policy.ts).
 *
 * Routes that predate the declaration are listed in route-authz-grandfather.json.
 * That list may only shrink: an entry whose route was removed, or whose route
 * now declares authz, fails the test until the entry is deleted.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import type { RouteOptions } from "fastify";
import {
  checkRouteAuthz,
  formatAuthzReport,
  isAuthzPolicy,
  isCleanAuthzReport,
  toAuthzRecords,
  type RouteAuthzRecord,
} from "../middleware/authz-policy.js";

const GRANDFATHER_PATH = fileURLToPath(
  new URL("./route-authz-grandfather.json", import.meta.url),
);

function route(
  method: RouteOptions["method"],
  url: string,
  authz?: unknown,
): RouteOptions {
  return {
    method,
    url,
    handler: async () => ({}),
    config: authz === undefined ? {} : { authz },
  } as RouteOptions;
}

describe("route authz checker", () => {
  it("reports a route with no authz declaration", () => {
    const records = toAuthzRecords(route("POST", "/api/new-thing"));
    const report = checkRouteAuthz(records, []);
    expect(report.undeclared).toEqual(["POST /api/new-thing"]);
    expect(isCleanAuthzReport(report)).toBe(false);
    expect(formatAuthzReport(report)).toContain("config: { authz: ... }");
  });

  it("accepts declared and grandfathered routes", () => {
    const records = [
      route("GET", "/api/me", "authenticated"),
      route("DELETE", "/api/models/:id", { model: "delete" }),
      route("GET", "/api/legacy"),
    ].flatMap(toAuthzRecords);
    const report = checkRouteAuthz(records, ["GET /api/legacy"]);
    expect(isCleanAuthzReport(report)).toBe(true);
    expect(report.checked).toBe(3);
  });

  it("reports malformed declarations", () => {
    const records = [
      route("GET", "/a", "public"),
      route("GET", "/b", { public: "" }),
      route("GET", "/c", { org: "MEMBER" }),
      route("GET", "/d", { model: "view", org: "ADMIN" }),
    ].flatMap(toAuthzRecords);
    expect(checkRouteAuthz(records, []).invalid).toEqual([
      "GET /a",
      "GET /b",
      "GET /c",
      "GET /d",
    ]);
  });

  it("fails when a grandfather entry is stale or already annotated", () => {
    const records = toAuthzRecords(route("GET", "/api/fixed", "superAdmin"));
    const report = checkRouteAuthz(records, [
      "GET /api/fixed",
      "GET /api/gone",
    ]);
    expect(report.annotatedGrandfather).toEqual(["GET /api/fixed"]);
    expect(report.staleGrandfather).toEqual(["GET /api/gone"]);
    expect(isCleanAuthzReport(report)).toBe(false);
  });

  it("folds automatic HEAD routes into their GET and skips plugin-owned routes", () => {
    const records = [
      route(["GET", "HEAD"], "/api/x"),
      route("OPTIONS", "*"),
      route("GET", "/docs/json"),
      route("HEAD", "/api/head-only"),
    ].flatMap(toAuthzRecords);
    const report = checkRouteAuthz(records, []);
    expect(report.undeclared).toEqual(["GET /api/x", "HEAD /api/head-only"]);
  });

  it("validates every policy shape", () => {
    for (const ok of [
      "authenticated",
      "superAdmin",
      { public: "signed webhook" },
      { handler: "checks model view" },
      { org: "OWNER" },
      { model: "manage" },
    ]) {
      expect(isAuthzPolicy(ok)).toBe(true);
    }
    for (const bad of [undefined, null, "handler", {}, { model: "admin" }]) {
      expect(isAuthzPolicy(bad)).toBe(false);
    }
  });
});

describe("route authz inventory (full app)", () => {
  const records: RouteAuthzRecord[] = [];

  beforeAll(async () => {
    // index.ts exits without JWT_SECRET; app.ts only needs the value passed in.
    const previousLogLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "silent";
    try {
      const { buildServer } = await import("../app.js");
      const app = await buildServer({
        jwtSecret: "route-authz-inventory-test-secret",
        onRoute: (r) => records.push(...toAuthzRecords(r)),
      });
      await app.ready();
      await app.close();
    } finally {
      if (previousLogLevel === undefined) delete process.env.LOG_LEVEL;
      else process.env.LOG_LEVEL = previousLogLevel;
    }
  });

  it("collects routes from nested protected scopes", () => {
    const keys = records.map((r) => `${r.method} ${r.url}`);
    expect(keys).toContain("GET /api/admin/users");
    expect(keys).toContain("GET /health");
  });

  it("every route declares config.authz or is grandfathered", () => {
    const grandfather = JSON.parse(
      readFileSync(GRANDFATHER_PATH, "utf8"),
    ) as string[];
    const report = checkRouteAuthz(records, grandfather);
    expect(isCleanAuthzReport(report), formatAuthzReport(report)).toBe(true);
  });
});
