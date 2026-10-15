/**
 * Routing Regression Tests
 *
 * Verifies all documented routes work correctly and don't 404.
 * Catches issues like the missing /models/new route.
 *
 * Run: npx playwright test routing.spec.ts
 */
import { test, expect, skipIfNotAuthenticated } from "../../fixtures/auth";
import { chooseBlankCanvas } from "../../fixtures/test-helpers";

test.describe("Protected Routes - No 404", () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  // All routes that should be accessible when authenticated
  const protectedRoutes = [
    { path: "/dashboard", description: "Dashboard page" },
    { path: "/projects", description: "Projects list" },
    { path: "/organization", description: "Organization settings" },
    { path: "/settings", description: "User settings" },
    { path: "/settings/ai", description: "AI provider settings" },
    { path: "/models/new", description: "New model creation page" },
  ];

  for (const route of protectedRoutes) {
    test(`${route.description} (${route.path}) loads without 404`, async ({
      authenticatedPage,
    }) => {
      const page = authenticatedPage;

      await page.goto(route.path);
      await page.waitForLoadState("networkidle");

      // Should NOT show 404
      const body = await page.locator("body").textContent();
      const has404 = body?.includes("404") && body?.includes("not found");
      expect(has404).toBeFalsy();

      // Should NOT redirect to login
      expect(page.url()).not.toContain("/login");

      // Page should have some content
      await expect(page.locator("body")).not.toBeEmpty();
    });
  }
});

test.describe("Dynamic Routes - Parameter Handling", () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("/models/new accepts projectId query parameter", async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    // First create a project
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const newProjectBtn = page
      .locator('button:has-text("New Project")')
      .first();
    if (await newProjectBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newProjectBtn.click();
      await page.locator("input#name").fill(`Route Test ${Date.now()}`);
      await page.locator('[role="dialog"] button:has-text("Create")').click();
      await page.waitForURL(/\/projects\//, { timeout: 10000 });

      const projectId = page.url().match(/\/projects\/([^/]+)/)?.[1];

      if (projectId) {
        // Navigate to /models/new with projectId
        await page.goto(`/models/new?projectId=${projectId}`);
        await page.waitForLoadState("networkidle");

        // Should show the create form
        await chooseBlankCanvas(page);
        const nameInput = page
          .locator('input#name, input[placeholder*="Model"]')
          .first();
        await expect(nameInput).toBeVisible({ timeout: 5000 });

        // Should NOT 404
        const body = await page.locator("body").textContent();
        expect(body?.includes("404")).toBeFalsy();
      }
    }
  });

  test("/projects/:id loads for valid project", async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    // Create a project first
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const newProjectBtn = page
      .locator('button:has-text("New Project")')
      .first();
    if (await newProjectBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newProjectBtn.click();
      await page.locator("input#name").fill(`Valid Project ${Date.now()}`);
      await page.locator('[role="dialog"] button:has-text("Create")').click();
      await page.waitForURL(/\/projects\//, { timeout: 10000 });

      // Should be on project page
      expect(page.url()).toMatch(/\/projects\/[^/]+/);

      // Should have content
      await expect(page.locator("h1, h2").first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("/models/:id loads for valid model", async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // First check if there are any existing models
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const modelLink = page.locator('a[href^="/models/"]').first();
    if (await modelLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await modelLink.click();
      await page.waitForURL(/\/models\//, { timeout: 10000 });

      // Should have React Flow canvas
      await expect(page.locator(".react-flow")).toBeVisible({ timeout: 15000 });
    } else {
      // No models exist - create one
      const newModelBtn = page.locator('button:has-text("New Model")').first();
      if (await newModelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await newModelBtn.click();
        await page
          .locator('input#name, input[placeholder*="Model"]')
          .first()
          .fill(`Route Test Model ${Date.now()}`);
        await page.locator('button:has-text("Create")').click();
        await page.waitForURL(/\/models\//, { timeout: 15000 });

        // Should have React Flow canvas
        await expect(page.locator(".react-flow")).toBeVisible({
          timeout: 15000,
        });
      }
    }
  });
});

test.describe("Settings Subroutes", () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  const settingsRoutes = [
    { path: "/settings", description: "Settings root" },
    { path: "/settings/ai", description: "AI settings" },
  ];

  for (const route of settingsRoutes) {
    test(`${route.description} (${route.path}) works`, async ({
      authenticatedPage,
    }) => {
      const page = authenticatedPage;

      await page.goto(route.path);
      await page.waitForLoadState("networkidle");

      // Should not 404
      expect(page.url()).not.toContain("404");

      // Should not redirect to login
      expect(page.url()).not.toContain("/login");

      // Should have settings-related content
      await expect(page.locator("body")).not.toBeEmpty();
    });
  }
});

test.describe("Navigation Links Work", () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("sidebar navigation links work", async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Test Projects link
    const projectsLink = page.locator('a[href="/projects"]').first();
    if (await projectsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await projectsLink.click();
      await page.waitForURL(/\/projects/, { timeout: 5000 });
      expect(page.url()).toContain("/projects");
    }

    // Test Settings link
    const settingsLink = page.locator('a[href="/settings"]').first();
    if (await settingsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingsLink.click();
      await page.waitForURL(/\/settings/, { timeout: 5000 });
      expect(page.url()).toContain("/settings");
    }

    // Test Dashboard link
    const dashboardLink = page.locator('a[href="/dashboard"]').first();
    if (await dashboardLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dashboardLink.click();
      await page.waitForURL(/\/dashboard/, { timeout: 5000 });
      expect(page.url()).toContain("/dashboard");
    }
  });
});
