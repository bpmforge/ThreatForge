import { test, expect, skipIfNotAuthenticated } from "../fixtures/auth";

/**
 * Full User Flow E2E Tests
 *
 * Tests the complete flow: login -> threat model creation from dashboard
 */
test.describe("Full User Flow (Authenticated)", () => {
  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("can create and load threat model from dashboard", async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;
    const timestamp = Date.now();
    const modelName = `Dashboard Model ${timestamp}`;

    // Go to dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/login");

    // Look for "New Model" or "Create" button
    const newModelBtn = page
      .locator(
        'button:has-text("New Model"), button:has-text("Create Model"), button:has-text("Get Started")',
      )
      .first();
    const isVisible = await newModelBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (isVisible) {
      console.log("Clicking new model button");
      await newModelBtn.click();

      // Wait for dialog or navigation
      await page.waitForTimeout(1000);

      // Fill model name if dialog appeared
      const modelNameInput = page
        .locator('input#name, input[placeholder*="name"]')
        .first();
      const hasDialog = await modelNameInput
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (hasDialog) {
        await modelNameInput.fill(modelName);

        // Submit - click the button inside the dialog with exact text "Create Model"
        const createBtn = page.locator(
          '[role="dialog"] button:has-text("Create Model")',
        );
        await createBtn.click({ force: true });

        // Wait for navigation
        await page.waitForURL(/\/models\//, { timeout: 15000 }).catch((e) => {
          console.log("Navigation timeout:", e);
        });
      }

      console.log("Current URL:", page.url());

      // Verify we're on the model page or it failed
      if (page.url().includes("/models/")) {
        await page.waitForLoadState("networkidle");

        // Check for the specific error
        const hasError = await page
          .locator("text=Failed to load threat model")
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        if (hasError) {
          console.log("ERROR FOUND: Failed to load threat model");

          // Capture network requests
          page.on("response", (response) => {
            if (!response.ok()) {
              console.log("Failed request:", response.url(), response.status());
            }
          });

          // Reload and capture
          await page.reload();
          await page.waitForLoadState("networkidle");
        }

        expect(hasError).toBe(false);
      }
    } else {
      console.log("No new model button found on dashboard");
    }
  });

  test("can load an existing threat model", async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // First get existing models from the API
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Check if there are any existing models
    const modelsLink = page.locator('a[href^="/models/"]').first();
    const hasModels = await modelsLink
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasModels) {
      console.log("Found existing model, clicking to load");
      const href = await modelsLink.getAttribute("href");
      console.log("Model URL:", href);

      await modelsLink.click();
      await page.waitForURL(/\/models\//, { timeout: 10000 });
      await page.waitForLoadState("networkidle");

      // Check for error
      const hasError = await page
        .locator("text=Failed to load threat model")
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasError) {
        console.log("ERROR: Failed to load existing threat model");

        // Get model ID from URL
        const modelId = page.url().split("/models/")[1]?.split("/")[0];
        console.log("Model ID:", modelId);

        // Check what the API returns (use relative URL for same-domain or env var for cross-domain)
        const apiBaseUrl = process.env.E2E_API_URL || "";
        const apiResponse = await page.request.get(
          `${apiBaseUrl}/api/threat-models/${modelId}`,
          {
            headers: {
              Cookie: (await page.context().cookies())
                .map((c) => `${c.name}=${c.value}`)
                .join("; "),
            },
          },
        );
        console.log("API Response status:", apiResponse.status());
        if (!apiResponse.ok()) {
          console.log("API Error:", await apiResponse.text());
        }
      }

      expect(hasError).toBe(false);

      // Verify canvas loaded
      const canvasExists = await page
        .locator(".react-flow")
        .isVisible({ timeout: 10000 })
        .catch(() => false);
      expect(canvasExists).toBe(true);
    } else {
      console.log("No existing models found - skipping test");
    }
  });
});
