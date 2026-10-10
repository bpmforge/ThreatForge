/**
 * A password reset must end every login issued before it: bearer access
 * tokens and refresh tokens whose `iat` predates User.passwordChangedAt are
 * rejected; tokens issued in the same second or later still work.
 */
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

const mockPrisma = {
  user: { findUnique: vi.fn() },
};

vi.mock("../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

const { authenticate, refreshToken, issuedBeforePasswordChange } = await import(
  "./auth.js"
);

const CHANGED_AT = new Date("2026-10-07T12:00:00.800Z");
const CHANGED_AT_SEC = Math.floor(CHANGED_AT.getTime() / 1000);

describe("issuedBeforePasswordChange", () => {
  it("is false when the password was never changed", () => {
    expect(issuedBeforePasswordChange(CHANGED_AT_SEC - 60, null)).toBe(false);
  });

  it("is true for a token issued in an earlier second", () => {
    expect(issuedBeforePasswordChange(CHANGED_AT_SEC - 1, CHANGED_AT)).toBe(
      true,
    );
  });

  it("is false for a token issued in the same second (the user's own fresh login)", () => {
    expect(issuedBeforePasswordChange(CHANGED_AT_SEC, CHANGED_AT)).toBe(false);
  });

  it("uses the later of the password change and sign-out-everywhere times", () => {
    const revoked = new Date(CHANGED_AT.getTime() + 60_000);
    const iat = CHANGED_AT_SEC + 30;
    expect(issuedBeforePasswordChange(iat, CHANGED_AT, revoked)).toBe(true);
    expect(issuedBeforePasswordChange(iat, null, revoked)).toBe(true);
    expect(issuedBeforePasswordChange(iat, CHANGED_AT, null)).toBe(false);
  });

  it("is true when the token has no iat and the password was changed", () => {
    expect(issuedBeforePasswordChange(undefined, CHANGED_AT)).toBe(true);
  });
});

describe("bearer JWT and refresh after a password change", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(fastifyCookie);
    await app.register(fastifyJwt, {
      secret: "test-secret-test-secret-test-secret",
    });
    app.get("/me", { preHandler: authenticate }, async (request) => ({
      id: request.authUser?.id,
    }));
    app.post("/refresh", async (request, reply) =>
      refreshToken(request, reply),
    );
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      status: "ACTIVE",
      passwordChangedAt: CHANGED_AT,
    });
  });

  const accessToken = (iat: number) =>
    app.jwt.sign({ id: "user-1", type: "access", iat }, { expiresIn: "100y" });
  const refresh = (iat: number) =>
    app.jwt.sign(
      { id: "user-1", type: "refresh", jti: `jti-${iat}`, iat },
      { expiresIn: "100y" },
    );

  it("rejects an access token issued before the reset", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${accessToken(CHANGED_AT_SEC - 10)}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it("accepts an access token issued after the reset", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${accessToken(CHANGED_AT_SEC + 10)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: "user-1" });
  });

  it("does not lock out an address for requests without a token", async () => {
    for (let i = 0; i < 12; i++) {
      await app.inject({ method: "GET", url: "/me" });
    }
    const res = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${accessToken(CHANGED_AT_SEC + 10)}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("rejects a refresh token used as an access token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${refresh(CHANGED_AT_SEC + 10)}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it.each(["PENDING_VERIFICATION", "SUSPENDED", "LOCKED", "DELETED"])(
    "rejects an access token for a %s account",
    async (status) => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        status,
        passwordChangedAt: null,
      });
      const res = await app.inject({
        method: "GET",
        url: "/me",
        headers: {
          authorization: `Bearer ${accessToken(CHANGED_AT_SEC + 10)}`,
        },
      });
      expect(res.statusCode).toBe(401);
    },
  );

  it("refuses to refresh with a refresh token issued before the reset", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/refresh",
      payload: { refreshToken: refresh(CHANGED_AT_SEC - 10) },
    });
    expect(res.statusCode).toBe(401);
  });

  it("refreshes with a refresh token issued after the reset", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/refresh",
      payload: { refreshToken: refresh(CHANGED_AT_SEC + 10) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toEqual(expect.any(String));
  });

  it("refuses to refresh for a user that no longer exists", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await app.inject({
      method: "POST",
      url: "/refresh",
      payload: { refreshToken: refresh(CHANGED_AT_SEC + 10) },
    });
    expect(res.statusCode).toBe(401);
  });
});
