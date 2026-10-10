/** authenticate() default-denies API-token requests by scope. */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import { createHash } from "crypto";

const TOKEN = "ftm_" + "a".repeat(40);
const mockPrisma = {
  user: { findUnique: vi.fn() },
  apiToken: { findFirst: vi.fn(), update: vi.fn() },
};

vi.mock("../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

const { authenticate } = await import("./auth.js");

function setScopes(scopes: string[]) {
  mockPrisma.apiToken.findFirst.mockResolvedValue({
    id: "tok-1",
    userId: "user-1",
    tokenHash: createHash("sha256").update(TOKEN).digest("hex"),
    expiresAt: null,
    scopes: JSON.stringify(scopes),
    user: { id: "user-1", email: "u@example.com", name: "U", status: "ACTIVE" },
  });
}

describe("authenticate with API tokens", () => {
  let app: FastifyInstance;
  const ok = async () => ({ ok: true });

  beforeAll(async () => {
    app = Fastify();
    await app.register(fastifyCookie);
    await app.register(fastifyJwt, {
      secret: "test-secret-test-secret-test-secret",
    });
    app.get("/api/threat-models", { preHandler: authenticate }, ok);
    app.post("/api/threat-models", { preHandler: authenticate }, ok);
    app.post("/api/users/me/api-tokens", { preHandler: authenticate }, ok);
    app.get("/api/projects", { preHandler: authenticate }, ok);
    app.get(
      "/api/override",
      {
        preHandler: authenticate,
        config: { scopes: ["read:projects"] } as Record<string, unknown>,
      },
      ok,
    );
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.apiToken.update.mockResolvedValue({});
  });

  const call = (method: "GET" | "POST", url: string) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${TOKEN}` },
    });

  it("accepts read:models on GET /api/threat-models", async () => {
    setScopes(["read:models"]);
    expect((await call("GET", "/api/threat-models")).statusCode).toBe(200);
  });

  it("rejects read:models on POST /api/threat-models", async () => {
    setScopes(["read:models"]);
    expect((await call("POST", "/api/threat-models")).statusCode).toBe(403);
  });

  it("accepts write:models on POST and on GET (write implies read)", async () => {
    setScopes(["write:models"]);
    expect((await call("POST", "/api/threat-models")).statusCode).toBe(200);
    expect((await call("GET", "/api/threat-models")).statusCode).toBe(200);
  });

  it("rejects any token on POST /api/users/me/api-tokens", async () => {
    setScopes(["read:models", "write:models", "write:projects"]);
    const res = await call("POST", "/api/users/me/api-tokens");
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toContain("API tokens cannot be used");
  });

  it("rejects a token without the projects scope", async () => {
    setScopes(["read:models"]);
    expect((await call("GET", "/api/projects")).statusCode).toBe(403);
  });

  it("route config.scopes overrides the URL mapping", async () => {
    setScopes(["read:projects"]);
    expect((await call("GET", "/api/override")).statusCode).toBe(200);
    setScopes(["read:models"]);
    expect((await call("GET", "/api/override")).statusCode).toBe(403);
  });
});
