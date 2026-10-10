/**
 * Cross-tenant suite.
 *
 * Builds the real app on the SQLite test DB, seeds org A (an outsider OWNER)
 * and org B (one of every resource, an OWNER and a SUSPENDED ADMIN), then
 * calls every id-bearing route from the route inventory with B's ids as:
 *   - outsider:  A's owner, who has no membership in B
 *   - suspended: B's suspended admin
 * Both must be refused (401/403/404/410). Reads run first and deletes last,
 * so a leaking delete cannot turn later routes into false 404s.
 *
 * Every route that is not refused is listed in cross-tenant-known.json as a
 * "allowed" (2xx: a leak unless the PR that listed it explains why not) or "unproven" (400/422/429/5xx/timeout: the request never
 * reached the authorization decision, so it proves nothing), and every
 * route whose params cannot be mapped to a seeded B resource is listed as
 * "unmapped" (including reads B's own owner gets 404 on). Routes that bypass
 * session auth are listed as "skipped". The file may only shrink: a new entry fails the test, and so
 * does an entry that no longer matches what the route does.
 *
 * Refresh after fixing routes: UPDATE_CROSS_TENANT=1 npx vitest run
 * src/__tests__/cross-tenant.test.ts (refuses to add entries).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance, RouteOptions } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { isAuthzPolicy } from "../middleware/authz-policy.js";
import type { CrossTenantSeed } from "../test/cross-tenant-seed.js";
import { buildUrl } from "../test/route-targets.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWN_PATH = resolve(__dirname, "cross-tenant-known.json");
const REQUEST_TIMEOUT_MS = 15_000;

type Outcome = "denied" | "allowed" | "unproven";
type Known = Record<string, "allowed" | "unproven" | "unmapped" | "skipped">;

function classify(status: number | "timeout"): Outcome {
  if (status === "timeout") return "unproven";
  if ([401, 403, 404, 410].includes(status)) return "denied";
  if (status >= 200 && status < 300) return "allowed";
  return "unproven";
}

interface IdRoute {
  method: string;
  url: string;
}

const PHASE: Record<string, number> = {
  GET: 0,
  POST: 1,
  PUT: 1,
  PATCH: 1,
  DELETE: 2,
};

describe("cross-tenant access", () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;
  let seed: CrossTenantSeed;
  const routes: IdRoute[] = [];
  const actual: Known = {};
  const statuses: Record<string, number | "timeout"> = {};

  const savedEnv = {
    LOG_LEVEL: process.env.LOG_LEVEL,
    REDIS_URL: process.env.REDIS_URL,
  };

  beforeAll(async () => {
    process.env.LOG_LEVEL = "silent";
    delete process.env.REDIS_URL;
    // No handler may reach the network while it is being probed.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network disabled in cross-tenant suite");
      }),
    );

    const { setupTestDatabase } = await import("../test/setup.js");
    prisma = await setupTestDatabase();
    const { seedCrossTenant } = await import("../test/cross-tenant-seed.js");
    seed = await seedCrossTenant(prisma);

    const { buildServer } = await import("../app.js");
    app = await buildServer({
      jwtSecret: "cross-tenant-suite-secret-cross-tenant-suite",
      onRoute: (r: RouteOptions) => {
        const config = (r.config ?? {}) as {
          authz?: unknown;
          skipAuth?: boolean;
        };
        if (!r.url.includes(":")) return;
        // Routes that bypass session auth (CI API keys, signed webhooks,
        // public tokens) need their own probe; record them, never drop them.
        const skipped =
          Boolean(r.websocket) ||
          Boolean(config.skipAuth) ||
          (isAuthzPolicy(config.authz) &&
            typeof config.authz === "object" &&
            "public" in config.authz);
        const methods = Array.isArray(r.method) ? r.method : [r.method];
        for (const method of methods) {
          if (!(method in PHASE)) continue;
          if (skipped) actual[`${method} ${r.url}`] = "skipped";
          else routes.push({ method, url: r.url });
        }
      },
    });
    await app.ready();
  }, 180_000);

  afterAll(async () => {
    vi.unstubAllGlobals();
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await app?.close();
    const { teardownTestDatabase } = await import("../test/setup.js");
    await teardownTestDatabase();
  });

  const token = (userId: string) =>
    app.jwt.sign({ id: userId, type: "access" }, { expiresIn: "1h" });

  async function call(method: string, url: string, userId: string) {
    const request = app.inject({
      method: method as "GET",
      url,
      headers: { authorization: `Bearer ${token(userId)}` },
      ...(method === "GET" || method === "DELETE" ? {} : { payload: {} }),
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<"timeout">((r) => {
      timer = setTimeout(() => r("timeout"), REQUEST_TIMEOUT_MS);
    });
    const res = await Promise.race([request, timeout]);
    clearTimeout(timer);
    return res === "timeout" ? "timeout" : res.statusCode;
  }

  /**
   * True when the suspended member's membership is no longer exactly as
   * seeded (a probe deleted or reactivated it); restores it so every later
   * probe still runs as a suspended member.
   */
  async function suspendedMembershipChanged(): Promise<boolean> {
    const where = {
      userId_organizationId: {
        userId: seed.users.suspendedB,
        organizationId: seed.b.org,
      },
    };
    const m = await prisma.membership.findUnique({ where });
    if (m?.status === "SUSPENDED" && m.role === "ADMIN") return false;
    await prisma.membership.upsert({
      where,
      update: { status: "SUSPENDED", role: "ADMIN" },
      create: {
        userId: seed.users.suspendedB,
        organizationId: seed.b.org,
        status: "SUSPENDED",
        role: "ADMIN",
      },
    });
    return true;
  }

  it("the seed is reachable by B's own owner (positive control)", async () => {
    const b = seed.b;
    for (const url of [
      `/api/projects/${b.project}`,
      `/api/organizations/${b.org}`,
      `/api/threat-models/${b.model}/threats/${b.threat}`,
    ]) {
      expect(await call("GET", url, seed.users.ownerB), url).toBe(200);
    }
  });

  it("refuses every id-bearing route to an outsider and a suspended member", async () => {
    const callers = {
      outsider: seed.users.outsider,
      suspended: seed.users.suspendedB,
    };
    // Guard against an empty inventory silently passing (≈410 on 2026-10-07)
    expect(routes.length).toBeGreaterThan(350);
    const ordered = [...routes].sort(
      (x, y) => PHASE[x.method] - PHASE[y.method],
    );
    for (const { method, url } of ordered) {
      const key = `${method} ${url}`;
      const target = buildUrl(url, seed.b);
      if (target === null) {
        actual[key] = "unmapped";
        continue;
      }
      // A read B's own owner cannot see means the params point at nothing,
      // so a refusal would prove nothing. (Writes are not pre-checked: as
      // the owner they would change B's data.)
      if (method === "GET") {
        const ownerStatus = await call(method, target, seed.users.ownerB);
        if (ownerStatus === 404) {
          actual[key] = "unmapped";
          continue;
        }
      }
      for (const [name, userId] of Object.entries(callers)) {
        const status = await call(method, target, userId);
        let outcome = classify(status);
        if (name === "suspended" && (await suspendedMembershipChanged())) {
          outcome = "allowed";
        }
        statuses[`${name} ${key}`] = status;
        if (outcome !== "denied") actual[`${name} ${key}`] = outcome;
      }
    }

    const known = JSON.parse(readFileSync(KNOWN_PATH, "utf8")) as Known;
    const added = Object.keys(actual).filter((k) => !(k in known));
    const changed = Object.keys(actual).filter(
      (k) => k in known && known[k] !== actual[k],
    );
    const fixed = Object.keys(known).filter((k) => !(k in actual));

    // Shrink-only refresh; an empty file is the one-time bootstrap.
    const bootstrap = Object.keys(known).length === 0;
    if (
      process.env.UPDATE_CROSS_TENANT === "1" &&
      (added.length === 0 || bootstrap)
    ) {
      const sorted = Object.fromEntries(
        Object.entries(actual).sort(([a], [b]) => a.localeCompare(b)),
      );
      writeFileSync(KNOWN_PATH, JSON.stringify(sorted, null, 2) + "\n");
      return;
    }

    const describeKeys = (keys: string[]) =>
      keys.map(
        (k) => `${k} → ${actual[k] ?? "denied"} (${statuses[k] ?? "-"})`,
      );
    expect(
      { new: describeKeys(added), changed: describeKeys(changed), fixed },
      "cross-tenant-known.json is out of date: fix newly allowed routes, remove fixed entries",
    ).toEqual({ new: [], changed: [], fixed: [] });
  }, 900_000);

  it("leaves every seeded B resource in place", async () => {
    const b = seed.b;
    const present = {
      org: await prisma.organization.count({ where: { id: b.org } }),
      project: await prisma.project.count({ where: { id: b.project } }),
      model: await prisma.threatModel.count({ where: { id: b.model } }),
      threat: await prisma.threat.count({ where: { id: b.threat } }),
      mitigation: await prisma.mitigation.count({
        where: { id: b.mitigation },
      }),
      webhook: await prisma.webhook.count({ where: { id: b.webhook } }),
      integration: await prisma.integration.count({
        where: { id: b.integration },
      }),
      threatLibrary: await prisma.threatLibrary.count({
        where: { id: b.threatLibrary },
      }),
      notification: await prisma.notification.count({
        where: { id: b.notification },
      }),
      apiToken: await prisma.apiToken.count({ where: { id: b.apiToken } }),
      ciKey: await prisma.cIApiKey.count({ where: { id: b.ciKey } }),
      riskFramework: await prisma.riskFramework.count({
        where: { id: b.riskFramework },
      }),
      customCategory: await prisma.customThreatCategory.count({
        where: { id: b.customCategory },
      }),
      role: await prisma.customRole.count({ where: { id: b.role } }),
      session: await prisma.userSession.count({ where: { id: b.session } }),
      ownerMembership: await prisma.membership.count({
        where: { id: b.ownerMembership, status: "ACTIVE", role: "OWNER" },
      }),
    };
    expect(present).toEqual(
      Object.fromEntries(Object.keys(present).map((k) => [k, 1])),
    );
  });
});
