import { test, expect } from "@playwright/test";

/**
 * Navigation Shell Tests
 *
 * Note: These tests require the dev server to be running and
 * may redirect to login if auth is required. We're testing the
 * basic structure is in place.
 */
test.describe("Navigation Shell", () => {
  // Skip tests if server has issues
  test.beforeEach(async () => {
    // Try to access a page - if we get redirected to login, that's OK
    // We're mainly checking the app builds and basic routing works
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");

    // Check we got a page (not a 500 error)
    const title = await page.title();
    expect(title).toBeTruthy();

    await page.screenshot({
      path: "e2e/screenshots/login.png",
      fullPage: true,
    });
  });

  test("root resolves appropriately", async ({ page }) => {
    const response = await page.goto("/");

    // `/` shows a landing page for unauthenticated users (it only redirects to
    // /dashboard when authenticated, or to /login when SKIP_LANDING_PAGE=true).
    // Any of those is fine — assert it resolved without a server error.
    expect(response?.status() ?? 200).toBeLessThan(400);
    const url = page.url();
    expect(
      url.includes("/dashboard") ||
        url.includes("/login") ||
        new URL(url).pathname === "/",
    ).toBeTruthy();
  });

  test("dashboard route exists", async ({ page }) => {
    const response = await page.goto("/dashboard");

    // Should either show dashboard or redirect to login
    // Not a 500 error
    expect(response?.status()).not.toBe(500);

    const url = page.url();
    expect(url.includes("/dashboard") || url.includes("/login")).toBeTruthy();
  });

  test("projects route exists", async ({ page }) => {
    const response = await page.goto("/projects");

    expect(response?.status()).not.toBe(500);

    const url = page.url();
    expect(url.includes("/projects") || url.includes("/login")).toBeTruthy();
  });

  test("templates route exists", async ({ page }) => {
    const response = await page.goto("/templates");

    expect(response?.status()).not.toBe(500);

    const url = page.url();
    expect(url.includes("/templates") || url.includes("/login")).toBeTruthy();
  });

  test("settings route exists", async ({ page }) => {
    const response = await page.goto("/settings");

    expect(response?.status()).not.toBe(500);

    const url = page.url();
    expect(url.includes("/settings") || url.includes("/login")).toBeTruthy();
  });

  test("no JavaScript errors on page load", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Filter out expected errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("hydrat") &&
        !e.includes("Warning:") &&
        !e.includes("Network"),
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
