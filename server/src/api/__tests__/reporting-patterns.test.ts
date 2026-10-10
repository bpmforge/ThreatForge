/**
 * Systemic-pattern endpoint — aggregation over the real test DB (SQLite or Postgres lane) and,
 * above all, cross-organization isolation.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { setupTestDatabase, teardownTestDatabase } from "../../test/setup.js";

const state = vi.hoisted(() => ({ prisma: null as unknown }));

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(async () => state.prisma),
}));

import {
  systemicPatternsSchema,
  getSystemicPatternsHandler,
} from "../reporting-patterns.js";

describe("GET /api/reporting/patterns/:orgId", () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;
  const ids = {
    alice: "",
    bob: "",
    carol: "",
    orgA: "",
    orgB: "",
  };

  async function addModel(
    orgId: string,
    userId: string,
    name: string,
    threats: Array<{
      name: string;
      severity?: "CRITICAL" | "HIGH" | "MEDIUM";
      status?: "OPEN" | "MITIGATED";
      cweIds?: string[];
    }>,
    deletedAt: Date | null = null,
  ) {
    const project = await prisma.project.create({
      data: {
        name: `${name}-proj`,
        organizationId: orgId,
        createdById: userId,
      },
    });
    await prisma.threatModel.create({
      data: {
        name,
        projectId: project.id,
        createdById: userId,
        deletedAt,
        threats: {
          create: threats.map((t) => ({
            name: t.name,
            createdById: userId,
            severity: t.severity ?? "HIGH",
            status: t.status ?? "OPEN",
            cweIds: JSON.stringify(t.cweIds ?? []),
          })),
        },
      },
    });
  }

  beforeAll(async () => {
    prisma = await setupTestDatabase();
    state.prisma = prisma;

    const mk = (email: string) =>
      prisma.user.create({
        data: { email, name: email },
        select: { id: true },
      });
    ids.alice = (await mk("alice@a.test")).id;
    ids.bob = (await mk("bob@b.test")).id;
    ids.carol = (await mk("carol@a.test")).id;

    ids.orgA = (
      await prisma.organization.create({
        data: { name: "A", slug: "org-a", ownerId: ids.alice },
      })
    ).id;
    ids.orgB = (
      await prisma.organization.create({
        data: { name: "B", slug: "org-b", ownerId: ids.bob },
      })
    ).id;

    await prisma.membership.create({
      data: { userId: ids.alice, organizationId: ids.orgA, role: "ADMIN" },
    });
    await prisma.membership.create({
      data: { userId: ids.bob, organizationId: ids.orgB, role: "ADMIN" },
    });
    // Carol is a suspended member of org A.
    await prisma.membership.create({
      data: {
        userId: ids.carol,
        organizationId: ids.orgA,
        role: "VIEWER",
        status: "SUSPENDED",
      },
    });

    // Org A: SQL injection recurs in 2 live models (+1 deleted model that must not count).
    await addModel(ids.orgA, ids.alice, "A1", [
      { name: "SQL Injection", severity: "CRITICAL", cweIds: ["CWE-89"] },
    ]);
    await addModel(ids.orgA, ids.alice, "A2", [
      { name: "sql injection", status: "MITIGATED", cweIds: ["CWE-89"] },
    ]);
    await addModel(
      ids.orgA,
      ids.alice,
      "A-deleted",
      [{ name: "SQL Injection", cweIds: ["CWE-89"] }],
      new Date(),
    );
    // Org B: a pattern that appears ONLY in org B, in 3 models, plus SQLi.
    for (const n of ["B1", "B2", "B3"]) {
      await addModel(ids.orgB, ids.bob, n, [
        { name: "Secret Org B Pattern" },
        { name: "SQL Injection", cweIds: ["CWE-89"] },
      ]);
    }

    app = Fastify();
    app.addHook("onRequest", async (request) => {
      const email = request.headers["x-test-user"];
      const userId = Object.entries(ids).find(([k]) => k === email)?.[1] as
        | string
        | undefined;
      if (userId) {
        request.authUser = { id: userId, email: `${email}@test` } as never;
      }
    });
    app.get<{
      Params: { orgId: string };
      Querystring: { minModels?: string };
    }>(
      "/api/reporting/patterns/:orgId",
      { schema: systemicPatternsSchema },
      getSystemicPatternsHandler,
    );
    await app.ready();
  }, 120000);

  afterAll(async () => {
    await app?.close();
    await teardownTestDatabase();
  });

  const get = (orgId: string, as: string, qs = "") =>
    app.inject({
      method: "GET",
      url: `/api/reporting/patterns/${orgId}${qs}`,
      headers: { "x-test-user": as },
    });

  it("returns recurring patterns for the caller's own org, excluding deleted models", async () => {
    const res = await get(ids.orgA, "alice");
    expect(res.statusCode).toBe(200);
    const body = res.json().data ?? res.json();
    expect(body.totalModels).toBe(2);
    const sqli = body.patterns.find(
      (p: { kind: string; key: string }) =>
        p.kind === "name" && p.key === "sql injection",
    );
    expect(sqli).toMatchObject({
      modelCount: 2,
      threatCount: 2,
      unmitigatedCount: 1,
      maxSeverity: "CRITICAL",
    });
    const names = sqli.affectedModels.map((m: { name: string }) => m.name);
    expect(names.sort()).toEqual(["A1", "A2"]);
  });

  it("never leaks another organization's models or patterns", async () => {
    const res = await get(ids.orgA, "alice");
    const text = JSON.stringify(res.json());
    expect(text).not.toContain("Secret Org B Pattern");
    expect(text).not.toMatch(/"B[123]"/);
  });

  it("forbids a user from reading an org they do not belong to", async () => {
    const res = await get(ids.orgB, "alice");
    expect(res.statusCode).toBe(403);
    expect(JSON.stringify(res.json())).not.toContain("Secret Org B Pattern");
  });

  it("forbids suspended members", async () => {
    expect((await get(ids.orgA, "carol")).statusCode).toBe(403);
  });

  it("scopes each org independently", async () => {
    const res = await get(ids.orgB, "bob");
    const body = res.json().data ?? res.json();
    expect(body.totalModels).toBe(3);
    expect(
      body.patterns.some((p: { label: string }) =>
        p.label.includes("Secret Org B Pattern"),
      ),
    ).toBe(true);
  });

  it("validates minModels", async () => {
    expect((await get(ids.orgA, "alice", "?minModels=1")).statusCode).toBe(400);
    expect((await get(ids.orgA, "alice", "?minModels=abc")).statusCode).toBe(
      400,
    );
    const ok = await get(ids.orgA, "alice", "?minModels=3");
    expect(ok.statusCode).toBe(200);
    expect((ok.json().data ?? ok.json()).patterns).toEqual([]);
  });

  it("is registered behind the authenticate preHandler", () => {
    const src = readFileSync(join(__dirname, "../reporting.ts"), "utf8");
    expect(src).toMatch(
      /"\/api\/reporting\/patterns\/:orgId",\s*\{[^}]*preHandler: authenticate/,
    );
  });
});
