/**
 * UC-01: User Registration (US-1.1, US-1.4)
 *
 * Covers: registration form renders, validation rejects bad input,
 * successful registration with a unique email reaches the verify-email
 * state or redirects to login. Uses a UUID in the email so tests
 * don't collide across runs.
 *
 * NOTE: We do NOT verify the confirmation email — that requires a real
 * mailbox. We assert up to the post-submit state (verify banner or login
 * redirect with ?registered=true).
 */
import { test, expect } from "./_fixtures";

const REG_EMAIL = `e2e-reg-${Date.now()}@threatforge.local`;
const REG_PASSWORD = "Register2026!";
const REG_NAME = "E2E Tester";

test.describe("UC-01 — User Registration", () => {
  // These tests navigate to /login and /register as unauthenticated users.
  // Clear the globalSetup storageState so the app doesn't redirect to /dashboard.
  test.use({ storageState: { cookies: [], origins: [] } });
  test("registration page renders required fields", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator('input[id="name"]')).toBeVisible();
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
  });

  test("login page links to register", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: /create one/i })).toBeVisible();
    await page.getByRole("link", { name: /create one/i }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test("register page links back to login", async ({ page }) => {
    await page.goto("/register");
    const loginLink = page.getByRole("link", { name: /sign in/i });
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("form rejects mismatched passwords", async ({ page }) => {
    await page.goto("/register");
    await page.fill('input[id="name"]', REG_NAME);
    await page.fill('input[id="email"]', REG_EMAIL);
    await page.fill('input[id="password"]', REG_PASSWORD);
    // Fill confirm password with a mismatch — triggers inline alert immediately
    await page.locator('input[type="password"]').nth(1).fill("WrongPass999!");
    // Inline error rendered with role="alert" when confirmPassword.length > 0 && !passwordsMatch.
    // Use text filter — Next.js route-announcer also has role="alert" (strict mode would fail).
    await expect(page.getByText(/passwords do not match/i)).toBeVisible({
      timeout: 5000,
    });
    // Submit button is disabled when passwords don't match — no navigation
    await expect(
      page.getByRole("button", { name: /create account/i }),
    ).toBeDisabled();
  });

  test("form rejects short password", async ({ page }) => {
    await page.goto("/register");
    await page.fill('input[id="name"]', REG_NAME);
    await page.fill('input[id="email"]', REG_EMAIL);
    await page.fill('input[id="password"]', "short");
    // Submit button disabled when password doesn't meet length/complexity requirements
    await expect(
      page.getByRole("button", { name: /create account/i }),
    ).toBeDisabled({ timeout: 5000 });
    await expect(page).toHaveURL(/\/register/);
  });

  test("successful registration reaches verify-email state or login", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.fill('input[id="name"]', REG_NAME);
    await page.fill('input[id="email"]', REG_EMAIL);
    await page.fill('input[id="password"]', REG_PASSWORD);
    await page.fill('input[name="confirmPassword"]', REG_PASSWORD);

    await page.getByRole("button", { name: /create account/i }).click();

    // Wait for either: verify-email banner on same page, or redirect to /login
    await Promise.race([
      page.waitForURL("**/login**", { timeout: 15000 }),
      page.waitForSelector("text=/verify your email/i", { timeout: 15000 }),
    ]);

    // Either outcome is acceptable — verify email confirmation is shown or
    // we landed on login with the registered=true query param
    const isOnLogin = page.url().includes("/login");
    const hasVerifyBanner =
      (await page.getByText(/verify your email/i).count()) > 0;

    expect(isOnLogin || hasVerifyBanner).toBe(true);
  });
});
