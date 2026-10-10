/**
 * The read-only guard is wired into the real app: a listed account is turned
 * away from every write on a protected route, before the route runs.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";

const DEMO = "demo-tour@threatforge.local";
const users: Record<string, { email: string }> = {
  demo: { email: DEMO },
  editor: { email: "editor@example.com" },
};

vi.mock("../db.js", () => ({
  getPrisma: async () => ({
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const u = users[where.id];
        return u
          ? {
              id: where.id,
              ...u,
              name: where.id,
              status: "ACTIVE",
              createdAt: new Date(0),
              memberships: [],
            }
          : null;
      },
    },
  }),
}));

describe("read-only account (full app)", () => {
  let app: FastifyInstance;
  const saved = process.env.DEMO_READONLY_USER_EMAILS;

  beforeAll(async () => {
    process.env.DEMO_READONLY_USER_EMAILS = DEMO;
    process.env.LOG_LEVEL = "silent";
    const { buildServer } = await import("../app.js");
    app = await buildServer({ jwtSecret: "read-only-account-test-secret" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    if (saved === undefined) delete process.env.DEMO_READONLY_USER_EMAILS;
    else process.env.DEMO_READONLY_USER_EMAILS = saved;
  });

  const bearer = (id: string) => ({
    authorization: `Bearer ${app.jwt.sign({ id, type: "access" })}`,
  });

  it.each([
    ["POST", "/api/organizations"],
    ["DELETE", "/api/threat-models/some-id"],
    ["PATCH", "/api/users/me"],
    ["PATCH", "/api/organizations/some-org/ai-settings"],
  ] as const)("rejects %s %s for the demo account", async (method, url) => {
    const res = await app.inject({
      method,
      url,
      headers: { ...bearer("demo"), "content-type": "application/json" },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("READ_ONLY_ACCOUNT");
  });

  it("does not stop a normal account at the guard", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { ...bearer("editor"), "content-type": "application/json" },
      payload: {},
    });
    expect(res.json().code).not.toBe("READ_ONLY_ACCOUNT");
  });

  it("tells the UI which account is read-only", async () => {
    const demo = await app.inject({
      url: "/api/users/me",
      headers: bearer("demo"),
    });
    expect(demo.json().data.readOnly).toBe(true);
    const editor = await app.inject({
      url: "/api/users/me",
      headers: bearer("editor"),
    });
    expect(editor.json().data.readOnly).toBe(false);
  });
});
