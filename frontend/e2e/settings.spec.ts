import { test, expect } from "@playwright/test";

/**
 * Settings Page Tests
 *
 * Tests the user settings pages and functionality.
 */
test.describe("Settings Routes", () => {
  test("settings page route exists", async ({ page }) => {
    const response = await page.goto("/settings");

    // Should redirect to login or show settings
    expect(response?.status()).not.toBe(500);

    const url = page.url();
    expect(url.includes("/settings") || url.includes("/login")).toBeTruthy();
  });
});

test.describe("Settings UI", () => {
  test("settings page has no critical JavaScript errors", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("/settings");
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
