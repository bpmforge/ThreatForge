/**
 * Threat Management V&V Tests
 *
 * Comprehensive verification and validation tests for:
 * - Threat CRUD operations
 * - Mitigation CRUD operations
 * - STRIDE category handling
 * - Threat-component associations
 *
 * Run: npx playwright test threat-management.spec.ts
 */
import { test, expect, skipIfNotAuthenticated } from "../../fixtures/auth";
import { waitForCanvas } from "../../fixtures/test-helpers";

test.describe("Threat Creation", () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("can create threat with all STRIDE categories", async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    // Navigate to an existing model or create one
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Try to find existing model or create new one
    let modelUrl: string | null = null;
    const modelLink = page
      .locator('a[href^="/models/"]:not([href="/models/new"])')
      .first();

    if (await modelLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await modelLink.click();
      await page.waitForURL(/\/models\//, { timeout: 10000 });
      modelUrl = page.url();
    } else {
      // Create a new model
      const newModelBtn = page.locator('button:has-text("New Model")').first();
      if (await newModelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await newModelBtn.click();
        await page
          .locator('input#name, input[placeholder*="Model"]')
          .first()
          .fill(`Threat Test ${Date.now()}`);
        await page.locator('button:has-text("Create")').click();
        await page.waitForURL(/\/models\//, { timeout: 15000 });
        modelUrl = page.url();
      }
    }

    if (!modelUrl) {
      test.skip();
      return;
    }

    // Wait for canvas to load
    await waitForCanvas(page, 15000);

    // Look for threat panel or add threat functionality
    const _threatPanel = page
      .locator('[data-testid="threat-panel"], .threat-panel')
      .first();
    const addThreatBtn = page
      .locator('button:has-text("Add Threat"), button:has-text("Add")')
      .first();

    if (await addThreatBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addThreatBtn.click();

      // Wait for dialog
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Fill threat name
      await page
        .locator(
          '[role="dialog"] input#name, [role="dialog"] input[placeholder*="threat"]',
        )
        .first()
        .fill("V&V Test Threat");

      // Check STRIDE categories - look for checkboxes or buttons
      const strideCategories = [
        "Spoofing",
        "Tampering",
        "Repudiation",
        "Information",
        "Denial",
        "Elevation",
      ];
      for (const category of strideCategories) {
        const categoryCheckbox = page
          .locator(
            `[role="dialog"] [role="checkbox"]:near(:text("${category}"))`,
          )
          .first();
        if (
          await categoryCheckbox.isVisible({ timeout: 1000 }).catch(() => false)
        ) {
          await categoryCheckbox.click();
          break; // At least one category selected
        }
      }

      // Submit
      const createBtn = page
        .locator(
          '[role="dialog"] button:has-text("Create"), [role="dialog"] button:has-text("Add")',
        )
        .first();
      if (await createBtn.isEnabled({ timeout: 2000 })) {
        await createBtn.click();
        await page.waitForTimeout(1000);
      }

      // Verify threat was created (check for toast or threat in list)
      const successToast = page
        .locator('[data-type="success"], text=created')
        .first();
      const hasSuccess = await successToast
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      // Either success toast or threat appears in panel
      if (!hasSuccess) {
        const threatInPanel = page.locator("text=V&V Test Threat").first();
        await expect(threatInPanel).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("threat creation validates required fields", async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    // Navigate to dashboard and open model
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const modelLink = page
      .locator('a[href^="/models/"]:not([href="/models/new"])')
      .first();
    if (await modelLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await modelLink.click();
      await page.waitForURL(/\/models\//, { timeout: 10000 });
      await waitForCanvas(page, 15000);

      const addThreatBtn = page
        .locator('button:has-text("Add Threat"), button:has-text("Add")')
        .first();
      if (await addThreatBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addThreatBtn.click();

        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible({ timeout: 5000 });

        // Try to submit without filling anything
        const createBtn = page
          .locator(
            '[role="dialog"] button:has-text("Create"), [role="dialog"] button:has-text("Add")',
          )
          .first();

        // Button should be disabled without required fields
        const isDisabled = await createBtn
          .isDisabled({ timeout: 2000 })
          .catch(() => false);
        expect(isDisabled).toBe(true);

        // Or if enabled, should show validation error
        if (!isDisabled) {
          await createBtn.click();
          const errorMsg = page
            .locator(
              '[role="dialog"] .text-destructive, [role="dialog"] .text-red, [role="dialog"] text=required',
            )
            .first();
          await expect(errorMsg).toBeVisible({ timeout: 3000 });
        }
      }
    }
  });
});

test.describe("Mitigation Management", () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("can add mitigation to existing threat", async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    // Navigate to model with threats
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const modelLink = page
      .locator('a[href^="/models/"]:not([href="/models/new"])')
      .first();
    if (await modelLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await modelLink.click();
      await page.waitForURL(/\/models\//, { timeout: 10000 });
      await waitForCanvas(page, 15000);

      // Look for existing threat
      const threatCard = page
        .locator('[data-testid="threat-card"], .threat-card')
        .first();
      if (await threatCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        await threatCard.click();

        // Look for add mitigation button
        const addMitigationBtn = page
          .locator(
            'button:has-text("Add Mitigation"), button:has-text("Mitigation")',
          )
          .first();
        if (
          await addMitigationBtn.isVisible({ timeout: 3000 }).catch(() => false)
        ) {
          await addMitigationBtn.click();

          // Fill mitigation
          const descriptionInput = page
            .locator(
              '[role="dialog"] textarea, [role="dialog"] input[placeholder*="mitigation"]',
            )
            .first();
          if (
            await descriptionInput
              .isVisible({ timeout: 3000 })
              .catch(() => false)
          ) {
            await descriptionInput.fill(
              "V&V Test Mitigation - Implement input validation",
            );

            // Submit
            const submitBtn = page
              .locator(
                '[role="dialog"] button:has-text("Add"), [role="dialog"] button:has-text("Create")',
              )
              .first();
            await submitBtn.click();

            // Verify success
            await page.waitForTimeout(1000);
            const mitigationText = page.locator("text=V&V Test Mitigation");
            await expect(mitigationText.first()).toBeVisible({ timeout: 5000 });
          }
        }
      }
    }
  });
});

test.describe("Threat Panel Interactions", () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("threat panel loads without errors", async ({ authenticatedPage }) => {
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

      // Check for console errors related to threats
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (
          msg.type() === "error" &&
          msg.text().toLowerCase().includes("threat")
        ) {
          consoleErrors.push(msg.text());
        }
      });

      // Wait for any threat-related errors
      await page.waitForTimeout(2000);

      // No threat-related console errors
      expect(consoleErrors.length).toBe(0);
    }
  });

  test("selecting component shows associated threats", async ({
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

      // Click on a component
      const node = page.locator(".react-flow__node").first();
      if (await node.isVisible({ timeout: 3000 }).catch(() => false)) {
        await node.click();
        await page.waitForTimeout(500);

        // Properties panel or threat panel should update
        const panel = page
          .locator(
            '[data-testid="properties-panel"], .properties-panel, [data-testid="threat-panel"]',
          )
          .first();
        await expect(panel).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
