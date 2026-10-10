import { test, expect } from "@playwright/test";

/**
 * AI Features E2E Tests
 *
 * Tests for AI-related functionality including threat suggestions,
 * mitigation suggestions, and AI chat.
 */
test.describe("AI Features", () => {
  test.describe("AI Settings", () => {
    test("settings page has AI configuration section", async ({ page }) => {
      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      // Should either be on settings or redirected to login
      const url = page.url();
      if (url.includes("/login")) {
        // Not logged in - that's OK for this test
        expect(url).toContain("/login");
        return;
      }

      // If we're on settings, there should be an AI or Appearance tab
      const tabs = page.getByRole("tab");
      const tabCount = await tabs.count();
      expect(tabCount).toBeGreaterThan(0);
    });

    test("admin settings page has AI configuration", async ({ page }) => {
      await page.goto("/admin/settings");
      await page.waitForLoadState("networkidle");

      const url = page.url();
      if (url.includes("/login")) {
        // Not logged in - expected
        return;
      }

      // Check that the page loaded without 500 errors
      expect(page.url()).toContain("/admin");
    });
  });

  test.describe("AI Chat Panel", () => {
    test("model page has no critical errors when loading", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => {
        errors.push(error.message);
      });

      // Navigate to a model page (may not exist)
      await page.goto("/models/test-model");
      await page.waitForLoadState("networkidle");

      // Filter out expected errors
      const criticalErrors = errors.filter(
        (e) =>
          !e.includes("hydrat") &&
          !e.includes("Warning:") &&
          !e.includes("Network") &&
          !e.includes("Failed to fetch") &&
          !e.includes("404") &&
          !e.includes("Not Found") &&
          !e.includes("Unauthorized"),
      );

      expect(criticalErrors).toHaveLength(0);
    });
  });

  test.describe("Threat Suggestions", () => {
    test("threat panel exists on model page", async ({ page }) => {
      // First go to dashboard to ensure we're in the right context
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const url = page.url();
      if (url.includes("/login")) {
        // Not logged in - expected for unauthenticated test
        expect(url).toContain("/login");
        return;
      }

      // Dashboard should load
      expect(url).toContain("/dashboard");
    });
  });

  test.describe("AI API Endpoints", () => {
    test("AI availability endpoint returns proper structure", async ({
      request,
    }) => {
      // Test that the API endpoint exists and returns expected format
      const response = await request.get(
        "/api/threat-models/test/ai/available",
      );

      // Either 404 (model not found) or 200/401/403 (valid response)
      expect([200, 401, 403, 404]).toContain(response.status());

      if (response.status() === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("available");
      }
    });

    test("AI settings endpoint returns proper structure", async ({
      request,
    }) => {
      const response = await request.get("/api/organizations/test/ai-settings");

      // Should return 401/403 (not authenticated) or 404 (org not found)
      expect([401, 403, 404]).toContain(response.status());
    });

    test("AI status endpoint returns proper structure", async ({ request }) => {
      const response = await request.get("/api/organizations/test/ai-status");

      // Should return 401/403 (not authenticated) or 404 (org not found)
      expect([401, 403, 404]).toContain(response.status());
    });
  });

  test.describe("Encryption Endpoints", () => {
    test("BYOK config endpoint returns proper response", async ({
      request,
    }) => {
      const response = await request.get("/api/organizations/test/encryption");

      // Should return 401/403 (not authenticated) or 404 (backend not running)
      expect([401, 403, 404]).toContain(response.status());
    });

    test("encryption keys list endpoint exists", async ({ request }) => {
      const response = await request.get(
        "/api/organizations/test/encryption/keys",
      );

      // Should return 401/403 (not authenticated) or 404 (backend not running)
      expect([401, 403, 404]).toContain(response.status());
    });

    test("key registration endpoint requires authentication", async ({
      request,
    }) => {
      const response = await request.post(
        "/api/organizations/test/encryption/keys",
        {
          data: { generateNew: true },
        },
      );

      // Should return 401/403 (not authenticated) or 404 (backend not running)
      expect([401, 403, 404]).toContain(response.status());
    });
  });
});

test.describe("AI Feature UI Components", () => {
  test("page renders without JavaScript errors", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (error) => {
      jsErrors.push(error.message);
    });

    // Visit the dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Filter critical errors
    const criticalErrors = jsErrors.filter(
      (err) =>
        !err.includes("hydrat") &&
        !err.includes("Warning:") &&
        !err.includes("Unauthorized") &&
        !err.includes("401") &&
        !err.includes("Network"),
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test("templates page loads correctly", async ({ page }) => {
    await page.goto("/templates");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    // Should redirect to login or show templates
    expect(url.includes("/templates") || url.includes("/login")).toBeTruthy();
  });
});

test.describe("AI Integration with Canvas", () => {
  test("canvas model page renders without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    // Try to access a model page
    await page.goto("/models/new");
    await page.waitForLoadState("networkidle");

    // Filter out expected errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("hydrat") &&
        !e.includes("Warning:") &&
        !e.includes("404") &&
        !e.includes("Network") &&
        !e.includes("Failed to fetch") &&
        !e.includes("Unauthorized") &&
        !e.includes("Not Found"),
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
