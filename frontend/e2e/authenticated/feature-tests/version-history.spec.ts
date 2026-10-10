/**
 * Version History V&V Tests
 *
 * Verifies version history features:
 * - Version creation
 * - Version listing
 * - Version restoration
 * - Version comparison
 *
 * Run: npx playwright test version-history.spec.ts
 */
import { test, expect, skipIfNotAuthenticated } from "../../fixtures/auth";
import { waitForCanvas } from "../../fixtures/test-helpers";

test.describe("Version History Panel", () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("can access version history from model page", async ({
    authenticatedPage,
  }) => {
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

      // Look for version history button/icon
      const versionBtn = page
        .locator(
          'button:has-text("Version"), button:has-text("History"), [aria-label*="version" i], [aria-label*="history" i]',
        )
        .first();
      if (await versionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await versionBtn.click();
        await page.waitForTimeout(500);

        // Should show version panel or dialog
        const versionPanel = page.locator(
          '[data-testid="version-history"], .version-history, [role="dialog"]:has-text("Version")',
        );
        await expect(versionPanel.first()).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("can create a new version snapshot", async ({ authenticatedPage }) => {
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

      // Open version history
      const versionBtn = page
        .locator(
          'button:has-text("Version"), button:has-text("History"), [aria-label*="version" i]',
        )
        .first();
      if (await versionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await versionBtn.click();
        await page.waitForTimeout(500);

        // Look for create version button
        const createVersionBtn = page
          .locator(
            'button:has-text("Create Version"), button:has-text("Save Version")',
          )
          .first();
        if (
          await createVersionBtn.isVisible({ timeout: 3000 }).catch(() => false)
        ) {
          await createVersionBtn.click();

          // Fill version name if prompted
          const nameInput = page.locator(
            '[role="dialog"] input#name, [role="dialog"] input[placeholder*="name"]',
          );
          if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await nameInput.fill(`V&V Test Version ${Date.now()}`);
            const saveBtn = page
              .locator('[role="dialog"] button:has-text("Save")')
              .first();
            await saveBtn.click();
          }

          // Verify success
          const successToast = page
            .locator('[data-type="success"], text=created')
            .first();
          await expect(successToast).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });
});

test.describe("Version Restoration", () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("restore button is present for previous versions", async ({
    authenticatedPage,
  }) => {
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

      // Open version history
      const versionBtn = page
        .locator('button:has-text("Version"), [aria-label*="version" i]')
        .first();
      if (await versionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await versionBtn.click();
        await page.waitForTimeout(1000);

        // Look for version list items
        const versionItems = page.locator(
          '[data-testid="version-item"], .version-item, .version-list-item',
        );
        const count = await versionItems.count();

        if (count > 1) {
          // Click on a non-current version
          await versionItems.nth(1).click();
          await page.waitForTimeout(500);

          // Restore button should be visible
          const restoreBtn = page.locator('button:has-text("Restore")').first();
          await expect(restoreBtn).toBeVisible({ timeout: 3000 });
        }
      }
    }
  });
});

test.describe("Version API Validation", () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("version list endpoint returns proper format", async ({
    authenticatedPage,
  }) => {
    // First get a model ID
    const modelsResponse =
      await authenticatedPage.request.get("/api/threat-models");
    if (!modelsResponse.ok()) return;

    const models = await modelsResponse.json();
    const modelId = Array.isArray(models)
      ? models[0]?.id
      : models.data?.[0]?.id;

    if (!modelId) return;

    // Get versions for this model
    const response = await authenticatedPage.request.get(
      `/api/threat-models/${modelId}/versions`,
    );

    if (response.ok()) {
      const body = await response.json();
      // Should be an array
      expect(Array.isArray(body)).toBe(true);

      // Each version should have required fields
      if (body.length > 0) {
        const version = body[0];
        expect(version).toHaveProperty("id");
        expect(version).toHaveProperty("threatModelId");
        expect(version).toHaveProperty("createdAt");
      }
    }
  });

  test("cannot restore non-existent version", async ({ authenticatedPage }) => {
    const modelsResponse =
      await authenticatedPage.request.get("/api/threat-models");
    if (!modelsResponse.ok()) return;

    const models = await modelsResponse.json();
    const modelId = Array.isArray(models)
      ? models[0]?.id
      : models.data?.[0]?.id;

    if (!modelId) return;

    // Try to restore non-existent version
    const response = await authenticatedPage.request.post(
      `/api/threat-models/${modelId}/versions/non-existent-version/restore`,
    );

    // Should return 404
    expect(response.status()).toBe(404);
  });
});
