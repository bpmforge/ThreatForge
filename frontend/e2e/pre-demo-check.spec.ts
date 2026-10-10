/**
 * Pre-Demo Quick Check
 *
 * Fast smoke test to run before demos. Verifies critical paths work:
 * - Dashboard loads
 * - Projects page loads
 * - Create project dialog opens
 * - Create model flow works
 * - Existing models can be loaded
 *
 * Run: npx playwright test pre-demo-check.spec.ts
 */
import { test, expect, skipIfNotAuthenticated } from "./fixtures/auth";

test.describe("Pre-Demo Check", () => {
  test.setTimeout(120000); // 2 minutes max

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("demo-critical features work", async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // Step 1: Dashboard loads (not redirected to login)
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/login");
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 10000 });

    // Step 2: Projects page loads
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/login");
    const projectsHeading = page
      .locator('h1:has-text("Projects"), text=Projects')
      .first();
    await expect(projectsHeading).toBeVisible({ timeout: 10000 });

    // Step 3: Create project dialog can be opened
    const newProjectBtn = page
      .locator('button:has-text("New Project")')
      .first();
    if (await newProjectBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newProjectBtn.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible({
        timeout: 5000,
      });
      // Close dialog
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    // Step 4: Create model dialog can be opened from dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const newModelBtn = page.locator('button:has-text("New Model")').first();
    if (await newModelBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newModelBtn.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible({
        timeout: 5000,
      });
      // Close dialog
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    // Step 5: /models/new route works (doesn't 404)
    await page.goto("/models/new");
    await page.waitForLoadState("networkidle");
    const has404 = await page
      .locator("text=404, text=Not Found")
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    expect(has404).toBe(false);
    // Should see create model form
    const nameInput = page
      .locator('input#name, input[placeholder*="Model"]')
      .first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });

    // Step 6: Existing models can be loaded (if any exist)
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const modelLink = page.locator('a[href^="/models/"]').first();
    if (await modelLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await modelLink.click();
      await page.waitForURL(/\/models\//, { timeout: 10000 });
      // Canvas should eventually load
      await expect(page.locator(".react-flow")).toBeVisible({ timeout: 15000 });
    }

    // No error toasts should be visible
    const errorToast = page.locator(
      '[data-type="error"], .toast-error, [role="alert"]:has-text("error")',
    );
    const errorCount = await errorToast.count();
    expect(errorCount).toBe(0);
  });
});

test.describe("Routing Health Check", () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  const criticalRoutes = [
    { path: "/dashboard", name: "Dashboard" },
    { path: "/projects", name: "Projects" },
    { path: "/organization", name: "Organization" },
    { path: "/settings", name: "Settings" },
    { path: "/models/new", name: "New Model" },
  ];

  for (const route of criticalRoutes) {
    test(`${route.name} (${route.path}) loads without 404`, async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto(route.path);
      await authenticatedPage.waitForLoadState("networkidle");

      // Should not show 404
      const has404 = await authenticatedPage
        .locator("text=404")
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      expect(has404).toBe(false);

      // Should not redirect to login
      expect(authenticatedPage.url()).not.toContain("/login");
    });
  }
});
