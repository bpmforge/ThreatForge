import { test } from "@playwright/test";

const BASE = process.env.TOUR_BASE_URL || "https://threatforge.bpmforge.com";
const DEMO_EMAIL = "demo-tour@threatforge.local";
const DEMO_PASSWORD = "DemoTour2026!";

test.describe("404 Model Handling", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("nonexistent model shows error, not crash", async ({ page }) => {
    test.setTimeout(30_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', DEMO_EMAIL);
    await page.fill('input[type="password"]', DEMO_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    await page.goto(`${BASE}/models/cmnxu0ws500ji07mwkw1zzssx`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: "e2e/product-tour/screenshots/verify-404-model.png",
    });

    const bodyText = (await page.locator("body").textContent()) || "";
    console.log("Page shows:", bodyText.substring(0, 500));
    console.log("JS errors:", errors);
  });
});
