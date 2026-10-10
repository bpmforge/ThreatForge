import { test, expect } from "@playwright/test";

/**
 * Export Functionality Tests
 *
 * Tests the export features (PDF, JSON, YAML, PNG, SVG).
 * Note: Full export tests require authentication and a valid model.
 * These tests verify the UI components and routes exist.
 */
test.describe("Export UI Components", () => {
  test("export feature module is bundled correctly", async ({ page }) => {
    // This tests that the export module doesn't cause build errors
    // by loading a page that imports export functionality
    const response = await page.goto("/models/test-model-id");

    // Should not be a 500 error (would indicate import/build failure)
    expect(response?.status()).not.toBe(500);
  });

  test("templates page loads (has export options for templates)", async ({
    page,
  }) => {
    const response = await page.goto("/templates");

    // Should redirect to login or load templates
    expect(response?.status()).not.toBe(500);

    const url = page.url();
    expect(url.includes("/templates") || url.includes("/login")).toBeTruthy();
  });
});

test.describe("Export Download Utilities", () => {
  // These are unit-style tests that verify export utilities work
  // The actual download tests are in unit tests

  test("no JavaScript errors on pages with export functionality", async ({
    page,
  }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("/models/test-model-id");
    await page.waitForLoadState("networkidle");

    // Filter out expected errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("hydrat") &&
        !e.includes("Warning:") &&
        !e.includes("Network") &&
        !e.includes("Failed to fetch") &&
        !e.includes("404") &&
        !e.includes("Unauthorized"),
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
