/**
 * Declared-policy enforcer (src/middleware/authz-enforce.ts).
 *
 * 1. Target resolution, unit level.
 * 2. Equivalence over the real app: for every route declaring `{ org }`,
 *    `{ model }` or `"superAdmin"`, call it as org B's viewer, editor, admin
 *    and owner. Whenever the enforcer refuses, the same call to an app built
 *    WITHOUT the enforcer must not succeed either — otherwise the declaration
 *    is stricter than the handler and enforcing it would break real users.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance, RouteOptions } from "fastify";
import type { PrismaClient } from "@prisma/client";
import {
  AUTHZ_POLICY_ERROR_CODE,
  AUTHZ_TARGET_ERROR_CODE,
  resolveAuthzTarget,
} from "../middleware/authz-enforce.js";
import type { CrossTenantSeed } from "../test/cross-tenant-seed.js";
import { buildUrl } from "../test/route-targets.js";

describe("resolveAuthzTarget", () => {
  it("prefers route params, by name", () => {
    expect(
      resolveAuthzTarget(
        "org",
        "/api/organizations/:orgId/x",
        { orgId: "o1" },
        {},
        {},
      ),
    ).toBe("o1");
    expect(
      resolveAuthzTarget(
        "model",
        "/api/threat-models/:modelId/x",
        { modelId: "m1" },
        { threatModelId: "other" },
        {},
      ),
    ).toBe("m1");
  });

  it("uses :id only when the route names that collection", () => {
    expect(
      resolveAuthzTarget("org", "/api/organizations/:id", { id: "o1" }, {}, {}),
    ).toBe("o1");
    expect(
      resolveAuthzTarget(
        "model",
        "/api/threat-models/:id/versions",
        { id: "m1" },
        {},
        {},
      ),
    ).toBe("m1");
    expect(
      resolveAuthzTarget("org", "/api/projects/:id", { id: "p1" }, {}, {}),
    ).toBeUndefined();
  });

  it("falls back to query, then body", () => {
    expect(
      resolveAuthzTarget(
        "org",
        "/api/ci/api-keys",
        {},
        { organizationId: "q" },
        { organizationId: "b" },
      ),
    ).toBe("q");
    expect(
      resolveAuthzTarget(
        "model",
        "/api/reviews",
        {},
        {},
        { threatModelId: "b" },
      ),
    ).toBe("b");
  });

  it("finds nothing when no source carries the id", () => {
    expect(
      resolveAuthzTarget("model", "/api/reviews", {}, {}, {}),
    ).toBeUndefined();
  });
});

const PHASE: Record<string, number> = {
  GET: 0,
  POST: 1,
  PUT: 1,
  PATCH: 1,
  DELETE: 2,
};

interface Declared {
  method: string;
  url: string;
  policy: unknown;
}

function isEnforceable(policy: unknown): boolean {
  return (
    policy === "superAdmin" ||
    (typeof policy === "object" &&
      policy !== null &&
      ("org" in policy || "model" in policy))
  );
}

describe("enforcer never refuses what the handler allows", () => {
  let prisma: PrismaClient;
  let enforced: FastifyInstance;
  let plain: FastifyInstance;
  let seed: CrossTenantSeed;
  const declared: Declared[] = [];
  const savedEnv = {
    LOG_LEVEL: process.env.LOG_LEVEL,
    REDIS_URL: process.env.REDIS_URL,
  };

  beforeAll(async () => {
    process.env.LOG_LEVEL = "silent";
    delete process.env.REDIS_URL;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network disabled in authz-enforce suite");
      }),
    );
    const { setupTestDatabase } = await import("../test/setup.js");
    prisma = await setupTestDatabase();
    const { seedCrossTenant } = await import("../test/cross-tenant-seed.js");
    seed = await seedCrossTenant(prisma);

    const { buildServer } = await import("../app.js");
    const jwtSecret = "authz-enforce-suite-secret-authz-enforce";
    enforced = await buildServer({
      jwtSecret,
      onRoute: (r: RouteOptions) => {
        const policy = (r.config as { authz?: unknown } | undefined)?.authz;
        if (!isEnforceable(policy)) return;
        const methods = Array.isArray(r.method) ? r.method : [r.method];
        for (const method of methods) {
          if (method in PHASE) declared.push({ method, url: r.url, policy });
        }
      },
    });
    plain = await buildServer({ jwtSecret, enforceAuthz: false });
    await Promise.all([enforced.ready(), plain.ready()]);
  }, 180_000);

  afterAll(async () => {
    vi.unstubAllGlobals();
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await enforced?.close();
    await plain?.close();
    const { teardownTestDatabase } = await import("../test/setup.js");
    await teardownTestDatabase();
  });

  async function call(
    app: FastifyInstance,
    method: string,
    url: string,
    userId: string,
  ) {
    const res = await app.inject({
      method: method as "GET",
      url,
      headers: {
        authorization: `Bearer ${app.jwt.sign({ id: userId, type: "access" }, { expiresIn: "1h" })}`,
      },
      ...(method === "GET" || method === "DELETE" ? {} : { payload: {} }),
    });
    let code: unknown;
    try {
      code = (res.json() as { code?: unknown }).code;
    } catch {
      code = undefined;
    }
    return { status: res.statusCode, code };
  }

  it("matches the handlers for B's viewer, editor, admin and owner", async () => {
    expect(declared.length).toBeGreaterThan(90);
    const callers = {
      viewer: seed.users.viewerB,
      editor: seed.users.editorB,
      admin: seed.users.adminB,
      owner: seed.users.ownerB,
    };
    const ordered = [...declared].sort(
      (x, y) => PHASE[x.method] - PHASE[y.method],
    );
    const tooStrict: string[] = [];
    let refusalsChecked = 0;
    for (const { method, url } of ordered) {
      const target = buildUrl(url, seed.b) ?? url;
      for (const [name, userId] of Object.entries(callers)) {
        const e = await call(enforced, method, target, userId);
        if (
          e.code !== AUTHZ_POLICY_ERROR_CODE &&
          e.code !== AUTHZ_TARGET_ERROR_CODE
        ) {
          continue;
        }
        refusalsChecked++;
        const p = await call(plain, method, target, userId);
        if (p.status >= 200 && p.status < 300) {
          tooStrict.push(
            `${name} ${method} ${url}: enforcer ${e.status} ${String(e.code)}, handler ${p.status}`,
          );
        }
      }
    }
    expect(refusalsChecked).toBeGreaterThan(0);
    expect(tooStrict).toEqual([]);
  }, 900_000);
});
