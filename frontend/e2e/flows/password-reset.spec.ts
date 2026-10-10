/**
 * Flow Test — Password Reset (Sequence Diagram 17)
 *
 * Follows docs/sdlc/SEQUENCE_DIAGRAMS.md §17:
 *   1. Request reset for known email → 200 regardless (prevents enumeration)
 *   2. Request reset for unknown email → also 200 (same protection)
 *   3. Submit confirm with invalid token → 400/404
 *   4. Submit confirm with valid token (mocked via API) → 200
 *
 * We can't intercept the real email in E2E, so steps 1-3 verify the
 * API surface and security properties. Step 4 is integration-only and
 * marked as a known limitation.
 */
import { test, expect, post } from "../api-contracts/_fixtures";

const RESET_REQUEST_URL = "/api/auth-public/password-reset/request";
const RESET_CONFIRM_URL = "/api/auth-public/password-reset/confirm";

test.describe("Password Reset — request endpoint security properties", () => {
  test("POST /request — known email returns 200 (no enumeration)", async ({
    loggedInPage: page,
  }) => {
    // demo-tour account exists
    const r = await post(page, RESET_REQUEST_URL, {
      email: "demo-tour@threatforge.local",
    });
    expect(r.status).toBe(200);
    const body = r.body as Record<string, unknown>;
    expect(body.message ?? body.success ?? body.data).toBeTruthy();
  });

  test("POST /request — unknown email also returns 200 (prevents user enumeration)", async ({
    loggedInPage: page,
  }) => {
    const r = await post(page, RESET_REQUEST_URL, {
      email: `nonexistent-${Date.now()}@example.com`,
    });
    // Must be 200, not 404 — prevents revealing whether email is registered
    expect(r.status).toBe(200);
  });

  test("POST /request — missing email returns 400 validation error", async ({
    loggedInPage: page,
  }) => {
    const r = await post(page, RESET_REQUEST_URL, {});
    expect(r.status).toBe(400);
    const body = r.body as Record<string, unknown>;
    expect(body).toHaveProperty("error");
  });

  test("POST /request — malformed email returns 400", async ({
    loggedInPage: page,
  }) => {
    const r = await post(page, RESET_REQUEST_URL, { email: "not-an-email" });
    expect([400, 422]).toContain(r.status);
  });
});

test.describe("Password Reset — confirm endpoint security properties", () => {
  test("POST /confirm — invalid token returns 400 not 500", async ({
    loggedInPage: page,
  }) => {
    const r = await post(page, RESET_CONFIRM_URL, {
      token: "definitely-invalid-token-xyz",
      password: "NewSecurePass123!",
    });
    // Must be 400/404, never 500
    expect(r.status).toBeLessThan(500);
    expect([400, 404, 422]).toContain(r.status);
    const body = r.body as Record<string, unknown>;
    expect(body).toHaveProperty("error");
  });

  test("POST /confirm — missing token returns 400", async ({
    loggedInPage: page,
  }) => {
    const r = await post(page, RESET_CONFIRM_URL, {
      password: "NewSecurePass123!",
    });
    expect(r.status).toBe(400);
  });

  test("POST /confirm — weak password returns 400 with error", async ({
    loggedInPage: page,
  }) => {
    const r = await post(page, RESET_CONFIRM_URL, {
      token: "any-token",
      password: "weak",
    });
    expect(r.status).toBeLessThan(500);
    expect([400, 422]).toContain(r.status);
  });
});

test.describe("Password Reset — unauthenticated access (public endpoint)", () => {
  test("POST /request — accessible without session (public endpoint)", async ({
    request,
  }) => {
    // This endpoint must work without auth — users are logged out when resetting
    const r = await request.post(RESET_REQUEST_URL, {
      data: { email: "demo-tour@threatforge.local" },
    });
    // 200 = works | 429 = rate limited (also valid) | NOT 401
    expect(r.status()).not.toBe(401);
    expect(r.status()).toBeLessThan(500);
  });

  test("POST /confirm — accessible without session (public endpoint)", async ({
    request,
  }) => {
    const r = await request.post(RESET_CONFIRM_URL, {
      data: { token: "fake-token", password: "AnyPass123!" },
    });
    // 400/404 = correct rejection | NOT 401 (must not require auth)
    expect(r.status()).not.toBe(401);
    expect(r.status()).toBeLessThan(500);
  });
});
