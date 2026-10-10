import { test, expect } from "@playwright/test";

const BASE = process.env.TOUR_BASE_URL || "https://threatforge.bpmforge.com";
const DEMO_EMAIL = "demo-tour@threatforge.local";
const DEMO_PASSWORD = "DemoTour2026!";

test.describe("Expand & Edit Verification", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("expand mitigations and open edit mitigation dialog", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', DEMO_EMAIL);
    await page.fill('input[type="password"]', DEMO_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

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
    await page.waitForTimeout(2000);

    // Click Threats tab
    await page
      .getByRole("tab", { name: /threats/i })
      .first()
      .click();
    await page.waitForTimeout(1500);

    // Find and click the expand button on the first threat (mitigations)
    const expandBtn = page.locator('button:has-text("mitigation")').first();
    await expect(expandBtn).toBeVisible({ timeout: 5000 });
    await expandBtn.click();
    await page.waitForTimeout(1000);

    // Screenshot: expanded mitigations in sidebar
    await page.screenshot({
      path: "e2e/product-tour/screenshots/verify-expand-mitigations.png",
    });

    // Click the mitigation description text to open EditMitigationDialog
    // The mitigation descriptions are <button> elements with title="Click to edit"
    const mitigationEditBtn = page
      .locator('button[title="Click to edit"]')
      .first();
    if ((await mitigationEditBtn.count()) > 0) {
      await mitigationEditBtn.click();
      await page.waitForTimeout(1000);

      // Screenshot: edit mitigation dialog
      await page.screenshot({
        path: "e2e/product-tour/screenshots/verify-edit-mitigation-dialog.png",
      });

      // Check if the dialog has a scroll area
      const dialogScrollArea = page.locator(
        '[role="dialog"] [data-radix-scroll-area-viewport], [role="dialog"] [data-slot="scroll-area-viewport"]',
      );
      const scrollCount = await dialogScrollArea.count();
      console.log(`Dialog scroll viewports found: ${scrollCount}`);

      if (scrollCount > 0) {
        // Try scrolling
        await dialogScrollArea.first().evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        await page.waitForTimeout(500);
        await page.screenshot({
          path: "e2e/product-tour/screenshots/verify-edit-mitigation-scrolled.png",
        });
        console.log("Dialog scrolled successfully");
      } else {
        // Check for overflow-y-auto fallback
        const overflowEl = page.locator(
          '[role="dialog"] .overflow-y-auto, [role="dialog"] .overflow-hidden',
        );
        console.log(`Dialog overflow elements: ${await overflowEl.count()}`);
      }

      // Check dialog title to confirm it's Edit Mitigation
      const title = page.locator(
        '[role="dialog"] h2, [role="dialog"] [data-slot="dialog-title"]',
      );
      if ((await title.count()) > 0) {
        console.log(`Dialog title: ${await title.first().textContent()}`);
      }
    } else {
      console.log("No mitigation edit button found");
    }

    console.log("Done");
  });
});
