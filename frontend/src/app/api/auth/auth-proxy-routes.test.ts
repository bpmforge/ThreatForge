/**
 * The backend's public auth endpoints live under /api/auth, which the
 * NextAuth catch-all also matches. Each one needs its own route file that
 * forwards to the backend, or NextAuth answers "Bad request." and password
 * reset / email verification silently break.
 */
import { describe, it, expect } from "vitest";
import * as proxy from "../[...proxy]/route";

const BACKEND_AUTH_PATHS = [
  "forgot-password",
  "reset-password",
  "verify-reset-token",
  "verify-email",
  "verification-status",
  "resend-verification",
];

describe("backend auth endpoints bypass the NextAuth catch-all", () => {
  it.each(BACKEND_AUTH_PATHS)(
    "/api/auth/%s forwards POST to the backend",
    async (path) => {
      const route = await import(`./${path}/route.ts`);
      expect(route.POST).toBe(proxy.POST);
    },
  );
});
