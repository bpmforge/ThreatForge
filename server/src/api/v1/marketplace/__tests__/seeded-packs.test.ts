/**
 * The marketplace ships with three seeded community packs, and an
 * organization can install (subscribe to) them.
 *
 * Runs against the shared test database (SQLite, or Postgres lane; schema pushed by
 * test/setup.ts) so the seed is exercised exactly as `db:seed` does on a fresh
 * DB, including the required author columns.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import {
  setupTestDatabase,
  teardownTestDatabase,
} from "../../../../test/setup.js";
import { seedMarketplacePacks } from "../../../../../prisma/seed/seed-packs.js";
import { COMMUNITY_PACKS } from "../../../../../prisma/seed/packs.js";

const state = vi.hoisted(() => ({
  prisma: null as unknown,
  userId: "",
}));

vi.mock("../../../../db.js", () => ({
  getPrisma: vi.fn(async () => state.prisma),
}));
vi.mock("../../helpers.js", () => ({
  getAuthUser: vi.fn(() => ({ id: state.userId, email: "admin@example.com" })),
  checkOrganizationAccess: vi.fn(async () => ({
    hasAccess: true,
    role: "OWNER",
  })),
  logAudit: vi.fn(),
}));

import { browseRoutes } from "../browse-routes.js";
import { subscriptionRoutes } from "../subscription-routes.js";

interface LibraryRow {
  id: string;
  name: string;
  templateCount: number;
  organizationName: string;
}
interface Payload {
  total: number;
  data: LibraryRow[];
}

/** sendSuccess may or may not wrap in `{ data }`; unwrap to the payload. */
function payload(res: { json: () => unknown }): Payload {
  const j = res.json() as { data?: unknown };
  return (j.data && !Array.isArray(j.data) ? j.data : j) as Payload;
}

describe("Seeded marketplace packs", () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;
  let subscriberOrgId: string;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
    state.prisma = prisma;

    const seedUser = await prisma.user.create({
      data: { email: "seed@threatforge.local", name: "Seeder" },
    });
    const subscriber = await prisma.user.create({
      data: { email: "admin@example.com", name: "Admin" },
    });
    state.userId = subscriber.id;
    const org = await prisma.organization.create({
      data: { name: "Acme", slug: "acme", ownerId: subscriber.id },
    });
    subscriberOrgId = org.id;

    expect(await seedMarketplacePacks(prisma, seedUser.id)).toBe(3);
    // Idempotent: a second run must not duplicate anything.
    expect(await seedMarketplacePacks(prisma, seedUser.id)).toBe(0);

    app = Fastify();
    await app.register(browseRoutes, { prefix: "/marketplace" });
    await app.register(subscriptionRoutes, { prefix: "/organizations" });
    await app.ready();
  }, 120000);

  afterAll(async () => {
    await app?.close();
    await teardownTestDatabase();
  });

  it("lists exactly three public packs, each with content", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/marketplace/libraries",
    });
    expect(res.statusCode).toBe(200);
    const body = payload(res);
    expect(body.total).toBe(3);
    expect(body.data.map((l) => l.name).sort()).toEqual(
      COMMUNITY_PACKS.map((p) => p.name).sort(),
    );
    for (const lib of body.data) {
      expect(lib.templateCount).toBeGreaterThanOrEqual(8);
      expect(lib.organizationName).toBe("ThreatForge Community");
    }
  });

  it("every seeded threat carries CWE and OWASP refs and resolvable mitigations", async () => {
    for (const pack of COMMUNITY_PACKS) {
      const mitigationNames = new Set(pack.mitigations.map((m) => m.name));
      for (const t of pack.threats) {
        expect(t.cweIds.length, t.name).toBeGreaterThan(0);
        expect(t.owaspIds.length, t.name).toBeGreaterThan(0);
        for (const m of t.mitigations) {
          expect(mitigationNames.has(m), `${t.name} -> ${m}`).toBe(true);
        }
      }
    }
    const threats = await prisma.threatTemplate.findMany({
      include: { library: true },
    });
    expect(threats.length).toBe(
      COMMUNITY_PACKS.reduce((n, p) => n + p.threats.length, 0),
    );
    expect(threats.every((t) => t.library.isPublic)).toBe(true);
  });

  it("attributes every seeded row to a real author", async () => {
    const libs = await prisma.mitigationLibrary.findMany();
    const tmpls = await prisma.mitigationTemplate.findMany();
    const authors = new Set([...libs, ...tmpls].map((r) => r.createdById));
    expect(authors.has(null)).toBe(false);
    for (const id of authors) {
      expect(
        await prisma.user.findUnique({ where: { id: String(id) } }),
      ).toBeTruthy();
    }
  });

  it("an org can install each pack and sees it in its subscriptions", async () => {
    const list = await app.inject({
      method: "GET",
      url: "/marketplace/libraries",
    });
    const libs = payload(list).data;

    for (const lib of libs) {
      const res = await app.inject({
        method: "POST",
        url: `/organizations/${subscriberOrgId}/marketplace/subscriptions`,
        payload: { libraryId: lib.id },
      });
      expect(res.statusCode).toBe(201);
    }

    const dup = await app.inject({
      method: "POST",
      url: `/organizations/${subscriberOrgId}/marketplace/subscriptions`,
      payload: { libraryId: libs[0].id },
    });
    expect(dup.statusCode).toBe(409);

    const subs = await app.inject({
      method: "GET",
      url: `/organizations/${subscriberOrgId}/marketplace/subscriptions`,
    });
    expect(payload(subs).data.length).toBe(3);
  });
});
