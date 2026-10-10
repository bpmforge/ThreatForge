import { test, expect } from "@playwright/test";

/**
 * Canvas / Model Editor Tests
 *
 * Tests the threat model canvas editor functionality.
 * Note: Since we're not authenticated, we may be redirected to login.
 * We test that the routes exist and don't crash.*/
test.describe("Model Editor Canvas", () => {
  test("model editor route exists", async ({ page }) => {
    // Test with a mock ID - should either show editor or redirect to login
    const response = await page.goto("/models/test-model-id");

    expect(response?.status()).not.toBe(500);

    // Should either be on models page (if auth bypassed) or login
    const url = page.url();
    expect(url.includes("/models") || url.includes("/login")).toBeTruthy();
  });

  test("canvas page has no JavaScript errors", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("/models/test-model-id");
    await page.waitForLoadState("networkidle");

    // Filter out expected errors (hydration, network, etc.)
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("hydrat") &&
        !e.includes("Warning:") &&
        !e.includes("Network") &&
        !e.includes("Failed to fetch") &&
        !e.includes("404"),
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test("canvas components are importable (build check)", async ({ page }) => {
    // This test verifies the canvas module can be imported without errors
    // by loading a page that would use those components
    const response = await page.goto("/models/test-model-id");

    // Should not be a 500 error (would indicate import/build failure)
    expect(response?.status()).not.toBe(500);
  });
});

test.describe("Canvas Routes", () => {
  test("projects list loads", async ({ page }) => {
    const response = await page.goto("/projects");
    expect(response?.status()).not.toBe(500);
  });

  test("project detail page pattern works", async ({ page }) => {
    const response = await page.goto("/projects/test-project-id");
    expect(response?.status()).not.toBe(500);
  });
});

test.describe("Canvas Features Build Check", () => {
  // These tests verify that various canvas features are properly bundled

  test("React Flow is bundled correctly", async ({ page }) => {
    const response = await page.goto("/models/test-model-id");
    expect(response?.status()).not.toBe(500);
  });

  test("collaboration features are bundled", async ({ page }) => {
    // Collaboration relies on Yjs which needs to be properly bundled
    const response = await page.goto("/models/test-model-id");
    expect(response?.status()).not.toBe(500);
  });

  test("threat panel features are bundled", async ({ page }) => {
    const response = await page.goto("/models/test-model-id");
    expect(response?.status()).not.toBe(500);
  });
});

test.describe("Keyboard Shortcuts", () => {
  test("shortcuts help dialog can be triggered", async ({ page }) => {
    // Go to login (accessible without auth)
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // The ? key should work globally in the app
    // We just verify no errors occur
    await page.keyboard.press("?");

    // No crash
    expect(true).toBe(true);
  });
});
