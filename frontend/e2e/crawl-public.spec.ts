/**
 * Playwright test to crawl public pages and capture all errors
 *
 * Run with: E2E_BASE_URL=https://your-domain.com npx playwright test crawl-public.spec.ts
 */
import { test } from "@playwright/test";

// Use environment variable for base URL, with sensible default for production testing
const BASE_URL =
  process.env.E2E_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  "http://localhost:3000";

// Store all errors
const networkErrors: {
  page: string;
  url: string;
  status: number;
  method: string;
}[] = [];
const consoleErrors: { page: string; message: string }[] = [];

test.describe("Network Error Crawl", () => {
  test.setTimeout(120000);

  test("capture all network errors", async ({ page }) => {
    // Ignore certificate errors for self-signed certs

    // Collect console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push({
          page: page.url(),
          message: msg.text().substring(0, 300),
        });
      }
    });

    // Collect ALL network requests that fail (4xx, 5xx)
    page.on("response", (response) => {
      if (response.status() >= 400) {
        networkErrors.push({
          page: page.url(),
          url: response.url(),
          status: response.status(),
          method: response.request().method(),
        });
      }
    });

    // Visit login page
    console.log("Visiting login page...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Try to log in with test credentials
    console.log("Attempting login...");
    const emailInput = page
      .locator('input[type="email"], input[name="email"]')
      .first();
    const passwordInput = page.locator('input[type="password"]').first();

    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Try common admin credentials
      await emailInput.fill("admin@threatforge.local");
      await passwordInput.fill("admin123");

      const loginButton = page.locator('button[type="submit"]').first();
      if (await loginButton.isVisible()) {
        await loginButton.click();
        await page.waitForTimeout(3000);
      }
    }

    // Check current page after login attempt
    console.log("Current URL:", page.url());

    // If we got logged in, try to visit various pages
    const pagesToCheck = [
      "/dashboard",
      "/projects",
      "/libraries",
      "/libraries/threats",
      "/libraries/components",
      "/libraries/compliance",
      "/analytics",
      "/analytics/risk",
      "/settings",
      "/profile",
      "/organization",
      "/notifications",
      "/templates",
      "/reports",
    ];

    for (const path of pagesToCheck) {
      console.log(`Checking ${path}...`);
      try {
        await page.goto(`${BASE_URL}${path}`, {
          waitUntil: "networkidle",
          timeout: 15000,
        });
        await page.waitForTimeout(1500);
      } catch (e) {
        console.log(`  Navigation error: ${e}`);
      }
    }

    // Print results
    console.log("\n\n========================================");
    console.log("NETWORK ERRORS FOUND");
    console.log("========================================\n");

    // Deduplicate network errors
    const uniqueErrors = new Map<string, (typeof networkErrors)[0]>();
    for (const err of networkErrors) {
      const key = `${err.method}:${err.status}:${err.url}`;
      if (!uniqueErrors.has(key)) {
        uniqueErrors.set(key, err);
      }
    }

    // Group by status code
    const errorsByStatus = new Map<number, typeof networkErrors>();
    for (const err of uniqueErrors.values()) {
      if (!errorsByStatus.has(err.status)) {
        errorsByStatus.set(err.status, []);
      }
      errorsByStatus.get(err.status)!.push(err);
    }

    for (const [status, errors] of [...errorsByStatus.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      console.log(`\n--- HTTP ${status} (${errors.length} unique) ---`);
      for (const err of errors) {
        // Extract just the path from the URL
        const urlPath = err.url.replace(BASE_URL, "");
        console.log(`  ${err.method} ${urlPath}`);
      }
    }

    if (consoleErrors.length > 0) {
      console.log("\n--- CONSOLE ERRORS ---");
      const uniqueConsole = new Map<string, string>();
      for (const err of consoleErrors) {
        const key = err.message.substring(0, 100);
        if (!uniqueConsole.has(key)) {
          uniqueConsole.set(key, err.message);
        }
      }
      for (const msg of uniqueConsole.values()) {
        console.log(`  ${msg.substring(0, 200)}`);
      }
    }

    console.log("\n========================================");
    console.log(`Total unique network errors: ${uniqueErrors.size}`);
    console.log(`Total console errors: ${consoleErrors.length}`);
    console.log("========================================\n");
  });
});
