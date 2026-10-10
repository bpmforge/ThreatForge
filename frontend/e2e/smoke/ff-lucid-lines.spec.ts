/**
 * Feature Flag Smoke Test — ff:lucid-lines
 *
 * Checks that the canvas loads without a pageerror for both flag=false and
 * flag=true. Runs against prod (smoke-prod project).
 *
 * Run:
 *   TOUR_BASE_URL=https://threatforge.bpmforge.com \
 *   npx playwright test e2e/smoke/ff-lucid-lines.spec.ts --project=smoke-prod
 */
import { test, expect } from "@playwright/test";

const DEMO_EMAIL = "demo-tour@threatforge.local";
const DEMO_PASSWORD = "DemoTour2026!";

async function loginAndGetModelId(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 20000 });

  const modelId = await page.evaluate(async () => {
    const r = await fetch("/api/threat-models", { credentials: "include" });
    const b = await r.json();
    return (b.data ?? b)[0]?.id as string | undefined;
  });

  return modelId;
}

for (const flagValue of ["false", "true"] as const) {
  test(`ff:lucid-lines=${flagValue} — canvas loads without pageerror`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message.slice(0, 200)));

    const modelId = await loginAndGetModelId(page);
    expect(modelId, "No models on demo account").toBeTruthy();

    // Set the feature flag in localStorage (we're on the same origin after login)
    await page.evaluate((val) => {
      localStorage.setItem("ff:lucid-lines", val);
    }, flagValue);

    // Navigate to the canvas page
    await page.goto(`/models/${modelId}`);

    // Race: wait for either the canvas wrapper OR a Next.js crash message.
    // A crash renders an h2 "Application error: …" and never shows rf__wrapper.
    const crashSelector = 'h2:has-text("Application error")';
    const canvasSelector = '[data-testid="rf__wrapper"]';

    let crashed = false;
    try {
      await Promise.race([
        page.waitForSelector(canvasSelector, { timeout: 45000 }),
        page.waitForSelector(crashSelector, { timeout: 45000 }).then(() => {
          crashed = true;
        }),
      ]);
    } catch {
      // Both selectors timed out — treat as crash (something went wrong)
      crashed = true;
      errors.push("Timed out waiting for canvas or crash indicator");
    }

    // Confirm the flag is still set (not clobbered by app init)
    const storedVal = await page
      .evaluate(() => localStorage.getItem("ff:lucid-lines"))
      .catch(() => "unavailable");
    console.log(`  localStorage ff:lucid-lines = ${storedVal}`);

    expect(
      crashed,
      `Canvas CRASHED with ff:lucid-lines=${flagValue}. pageerrors: ${errors.join("; ")}`,
    ).toBe(false);

    expect(
      errors,
      `Canvas had pageerror(s) with ff:lucid-lines=${flagValue}: ${errors.join("; ")}`,
    ).toHaveLength(0);
  });
}
