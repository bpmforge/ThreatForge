/**
 * Verify mitigation detail renders when clicking into a threat.
 * Opens Online Checkout, clicks first threat card, checks mitigations appear.
 */
import { test, expect } from "@playwright/test";

const DEMO_EMAIL = "demo-tour@threatforge.local";
const DEMO_PASSWORD = "DemoTour2026!";
const BASE = process.env.TOUR_BASE_URL || "https://threatforge.bpmforge.com";

test.describe("Verify Mitigation Detail", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("threat detail shows mitigations", async ({ page }) => {
    test.setTimeout(60_000);

    // Login
    await page.goto(`${BASE}/login`);
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', DEMO_EMAIL);
    await page.fill('input[type="password"]', DEMO_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Find Online Checkout model
    const modelId = await page.evaluate(async () => {
      const res = await fetch("/api/threat-models", { credentials: "include" });
      const body = (await res.json()) as {
        data: Array<{ id: string; name: string }>;
      };
      return body.data.find((m) => m.name.includes("Online Checkout"))?.id;
    });

    expect(modelId).toBeTruthy();
    await page.goto(`${BASE}/models/${modelId}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // Click Threats tab
    const threatsTab = page.getByRole("tab", { name: /threats/i }).first();
    await threatsTab.click();
    await page.waitForTimeout(1500);

    // Find and click the first threat card that shows mitigations count
    const threatCard = page.locator("text=/mitigation/i").first();
    await expect(threatCard).toBeVisible({ timeout: 5000 });

    // Click on the threat card area (the parent clickable element)
    const clickTarget = threatCard
      .locator(
        "xpath=ancestor::div[contains(@class, 'cursor') or contains(@class, 'card') or @role='button']",
      )
      .first();

    if ((await clickTarget.count()) > 0) {
      await clickTarget.click();
    } else {
      await threatCard.click();
    }
    await page.waitForTimeout(2000);

    // Screenshot the detail view
    await page.screenshot({
      path: "e2e/product-tour/screenshots/verify-mitigation-detail.png",
      fullPage: false,
    });

    // Check for mitigation-related content in the expanded view
    const mitigationElements = page.locator(
      "text=/mitigation|strategy|priority|status|implementation/i",
    );
    const count = await mitigationElements.count();
    console.log(`Found ${count} mitigation-related elements after clicking`);
    expect(count).toBeGreaterThan(2);

    console.log("✅ Mitigation detail renders correctly");
  });
});
