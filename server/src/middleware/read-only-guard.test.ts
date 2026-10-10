import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import {
  READ_ONLY_ERROR_CODE,
  isReadOnlyUser,
  readOnlyGuard,
} from "./read-only-guard.js";

const DEMO = "demo-tour@threatforge.local";

async function buildApp(email: string | undefined): Promise<FastifyInstance> {
  const app = Fastify();
  app.addHook("preHandler", async (request) => {
    request.authUser = email ? { id: "u1", email } : undefined;
  });
  app.addHook("preHandler", readOnlyGuard);
  for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
    app.route({
      method,
      url: "/api/thing",
      handler: async () => ({ ok: true }),
    });
  }
  app.post("/api/organizations", async () => ({ created: true }));
  await app.ready();
  return app;
}

describe("isReadOnlyUser", () => {
  it("matches listed emails case-insensitively and ignores blanks", () => {
    const env = {
      DEMO_READONLY_USER_EMAILS: ` ${DEMO.toUpperCase()} , ,x@y.z`,
    };
    expect(isReadOnlyUser(DEMO, env)).toBe(true);
    expect(isReadOnlyUser("x@y.z", env)).toBe(true);
    expect(isReadOnlyUser("someone@else.com", env)).toBe(false);
    expect(isReadOnlyUser(undefined, env)).toBe(false);
  });

  it("is off when the variable is unset", () => {
    expect(isReadOnlyUser(DEMO, {})).toBe(false);
  });
});

describe("readOnlyGuard", () => {
  const saved = process.env.DEMO_READONLY_USER_EMAILS;
  beforeEach(() => {
    process.env.DEMO_READONLY_USER_EMAILS = DEMO;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.DEMO_READONLY_USER_EMAILS;
    else process.env.DEMO_READONLY_USER_EMAILS = saved;
  });

  it("lets a read-only user read", async () => {
    const app = await buildApp(DEMO);
    const res = await app.inject({ method: "GET", url: "/api/thing" });
    expect(res.statusCode).toBe(200);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"] as const)(
    "rejects %s from a read-only user with 403 and a stable code",
    async (method) => {
      const app = await buildApp(DEMO);
      const res = await app.inject({ method, url: "/api/thing" });
      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.code).toBe(READ_ONLY_ERROR_CODE);
      expect(body.message).toMatch(/read-only/i);
    },
  );

  it("blocks organization creation, the old escalation path", async () => {
    const app = await buildApp(DEMO);
    const res = await app.inject({ method: "POST", url: "/api/organizations" });
    expect(res.statusCode).toBe(403);
  });

  it("leaves other users alone", async () => {
    const app = await buildApp("editor@example.com");
    const res = await app.inject({ method: "DELETE", url: "/api/thing" });
    expect(res.statusCode).toBe(200);
  });
});
