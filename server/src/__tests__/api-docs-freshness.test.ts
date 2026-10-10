/**
 * docs/FEATURES.md API route tables are generated from the real app
 * (src/docs/route-docs.ts). This re-renders them in memory and fails when the
 * committed section is stale, so the docs cannot drift from the routes again.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import {
  FEATURES_PATH,
  collectRouteDocs,
  formatAuthz,
  renderRoutesSection,
  routeGroup,
  spliceGeneratedSection,
  type RouteDoc,
} from "../docs/route-docs.js";

describe("route docs rendering", () => {
  it("groups by top-level path", () => {
    expect(routeGroup("/api/organizations/:id/webhooks")).toBe(
      "/api/organizations",
    );
    expect(routeGroup("/api/v1/threat-models/:id")).toBe(
      "/api/v1/threat-models",
    );
    expect(routeGroup("/health")).toBe("/health");
    expect(routeGroup("/api")).toBe("/api");
  });

  it("formats every authz shape", () => {
    expect(formatAuthz(undefined)).toBe("— (grandfathered)");
    expect(formatAuthz("superAdmin")).toBe("superAdmin");
    expect(formatAuthz({ org: "ADMIN" })).toBe("org:ADMIN");
    expect(formatAuthz({ model: "view" })).toBe("model:view");
    expect(formatAuthz({ public: "health check" })).toBe(
      "public (health check)",
    );
  });

  it("escapes table-breaking characters in descriptions", () => {
    const out = renderRoutesSection([
      {
        method: "GET",
        url: "/a",
        authz: "authenticated",
        description: "x | y\nz",
      },
    ]);
    expect(out).toContain("| GET | `/a` | authenticated | x \\| y z |");
  });

  it("rejects a document without both markers", () => {
    expect(() => spliceGeneratedSection("no markers", "x")).toThrow(
      /BEGIN GENERATED ROUTES/,
    );
  });
});

describe("docs/FEATURES.md generated routes (full app)", () => {
  let routes: RouteDoc[] = [];

  beforeAll(async () => {
    routes = await collectRouteDocs();
  });

  it("collects the app's routes", () => {
    expect(routes.map((r) => `${r.method} ${r.url}`)).toContain(
      "GET /api/admin/users",
    );
  });

  it("is up to date with the registered routes", () => {
    const committed = readFileSync(FEATURES_PATH, "utf8");
    const expected = spliceGeneratedSection(
      committed,
      renderRoutesSection(routes),
    );
    expect(
      committed === expected,
      'docs/FEATURES.md API routes are stale. Run "npm run docs:routes" in server/ and commit docs/FEATURES.md.',
    ).toBe(true);
  });
});
