import { test, expect } from "@playwright/test";

/**
 * Admin Console Tests
 *
 * Tests the admin console pages and functionality.
 * Admin pages require authentication and admin role.
 */
test.describe("Admin Console Routes", () => {
  test("admin dashboard route exists", async ({ page }) => {
    const response = await page.goto("/admin");

    // Should redirect to login or show admin (if authorized)
    expect(response?.status()).not.toBe(500);

    const url = page.url();
    expect(url.includes("/admin") || url.includes("/login")).toBeTruthy();
  });

  test("admin users page route exists", async ({ page }) => {
    const response = await page.goto("/admin/users");
    expect(response?.status()).not.toBe(500);
  });

  test("admin organizations page route exists", async ({ page }) => {
    const response = await page.goto("/admin/organizations");
    expect(response?.status()).not.toBe(500);
  });

  test("admin audit log page route exists", async ({ page }) => {
    const response = await page.goto("/admin/audit");
    expect(response?.status()).not.toBe(500);
  });

  test("admin settings page route exists", async ({ page }) => {
    const response = await page.goto("/admin/settings");
    expect(response?.status()).not.toBe(500);
  });
});

test.describe("Admin Console UI", () => {
  test("admin pages have no critical JavaScript errors", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    // Test each admin route
    const adminRoutes = [
      "/admin",
      "/admin/users",
      "/admin/organizations",
      "/admin/audit",
      "/admin/settings",
    ];

    for (const route of adminRoutes) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
    }

    // Filter out expected errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("hydrat") &&
        !e.includes("Warning:") &&
        !e.includes("Network") &&
        !e.includes("Failed to fetch") &&
        !e.includes("404") &&
        !e.includes("Unauthorized") &&
        !e.includes("Forbidden"),
    );

    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe("Admin Access Control", () => {
  test("unauthenticated user cannot access admin", async ({ page }) => {
    await page.goto("/admin");

    // Should redirect to login
    await page.waitForURL(/\/login/, { timeout: 5000 });
    expect(page.url()).toContain("/login");
  });
});
