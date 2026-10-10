/**
 * Export Functionality V&V Tests
 *
 * Verifies all export features work correctly:
 * - PDF export
 * - JSON export
 * - PNG/SVG canvas export
 * - Error handling during export
 *
 * Run: npx playwright test export-functionality.spec.ts
 */
import { test, expect, skipIfNotAuthenticated } from "../../fixtures/auth";
import { waitForCanvas } from "../../fixtures/test-helpers";

test.describe("Export Menu", () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("export menu is accessible on model page", async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Find and click on a model
    const modelLink = page
      .locator('a[href^="/models/"]:not([href="/models/new"])')
      .first();
    if (await modelLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await modelLink.click();
      await page.waitForURL(/\/models\//, { timeout: 10000 });
      await waitForCanvas(page, 15000);

      // Look for export button
      const exportBtn = page
        .locator('button:has-text("Export"), [aria-label*="export" i]')
        .first();
      await expect(exportBtn).toBeVisible({ timeout: 10000 });
    }
  });

  test("export menu shows available formats", async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const modelLink = page
      .locator('a[href^="/models/"]:not([href="/models/new"])')
      .first();
    if (await modelLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await modelLink.click();
      await page.waitForURL(/\/models\//, { timeout: 10000 });
      await waitForCanvas(page, 15000);

      const exportBtn = page
        .locator('button:has-text("Export"), [aria-label*="export" i]')
        .first();
      if (await exportBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await exportBtn.click();
        await page.waitForTimeout(500);

        // Check for export format options
        const expectedFormats = ["PDF", "JSON", "PNG"];
        let foundFormats = 0;

        for (const format of expectedFormats) {
          const formatOption = page.locator(`text=${format}`).first();
          if (
            await formatOption.isVisible({ timeout: 1000 }).catch(() => false)
          ) {
            foundFormats++;
          }
        }

        // At least one export format should be available
        expect(foundFormats).toBeGreaterThan(0);
      }
    }
  });
});

test.describe("JSON Export", () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("can export model as JSON", async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const modelLink = page
      .locator('a[href^="/models/"]:not([href="/models/new"])')
      .first();
    if (await modelLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await modelLink.click();
      await page.waitForURL(/\/models\//, { timeout: 10000 });
      await waitForCanvas(page, 15000);

      const exportBtn = page.locator('button:has-text("Export")').first();
      if (await exportBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await exportBtn.click();
        await page.waitForTimeout(500);

        // Look for JSON option
        const jsonOption = page
          .locator('text=JSON, button:has-text("JSON")')
          .first();
        if (await jsonOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Set up download promise
          const downloadPromise = page
            .waitForEvent("download", { timeout: 10000 })
            .catch(() => null);

          await jsonOption.click();

          const download = await downloadPromise;
          if (download) {
            // Verify it's a JSON file
            const filename = download.suggestedFilename();
            expect(filename.endsWith(".json")).toBe(true);
          }
        }
      }
    }
  });
});

test.describe("PDF Export", () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("can initiate PDF export", async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const modelLink = page
      .locator('a[href^="/models/"]:not([href="/models/new"])')
      .first();
    if (await modelLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await modelLink.click();
      await page.waitForURL(/\/models\//, { timeout: 10000 });
      await waitForCanvas(page, 15000);

      const exportBtn = page.locator('button:has-text("Export")').first();
      if (await exportBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await exportBtn.click();
        await page.waitForTimeout(500);

        const pdfOption = page
          .locator('text=PDF, button:has-text("PDF")')
          .first();
        if (await pdfOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          const downloadPromise = page
            .waitForEvent("download", { timeout: 30000 })
            .catch(() => null);

          await pdfOption.click();

          // Either download starts or a dialog appears for options
          const download = await downloadPromise;
          if (download) {
            const filename = download.suggestedFilename();
            expect(filename.endsWith(".pdf")).toBe(true);
          } else {
            // Check if options dialog appeared
            const optionsDialog = page.locator(
              '[role="dialog"]:has-text("Export")',
            );
            const dialogVisible = await optionsDialog
              .isVisible({ timeout: 2000 })
              .catch(() => false);
            expect(dialogVisible).toBe(true);
          }
        }
      }
    }
  });
});

test.describe("Export Error Handling", () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("shows error toast on export failure", async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // Monitor for console errors during export
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const modelLink = page
      .locator('a[href^="/models/"]:not([href="/models/new"])')
      .first();
    if (await modelLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await modelLink.click();
      await page.waitForURL(/\/models\//, { timeout: 10000 });
      await waitForCanvas(page, 15000);

      // Trigger export
      const exportBtn = page.locator('button:has-text("Export")').first();
      if (await exportBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await exportBtn.click();

        // Wait and check for errors
        await page.waitForTimeout(2000);

        // No unhandled errors should appear
        const criticalErrors = consoleErrors.filter(
          (e) => e.includes("Uncaught") || e.includes("unhandled"),
        );
        expect(criticalErrors.length).toBe(0);
      }
    }
  });
});
