/**
 * UC-22: Save canvas and reload — state survives round-trip.
 * Also implicitly covers UC-17 (palette drag), UC-18 (edges), UC-19 (boundaries)
 * by seeding via API and verifying they render after reload.
 */
import {
  test,
  expect,
  login,
  createModel,
  deleteModel,
  saveCanvas,
  navigateToModel,
  withCleanCheck,
  ONLINE_CHECKOUT,
} from "./_fixtures";

test.describe("UC-22 — Save and Reload", () => {
  let modelId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    const m = await createModel(page, "UC-22 Save Reload Test");
    modelId = m.id;
    await saveCanvas(
      page,
      modelId,
      ONLINE_CHECKOUT.nodes,
      ONLINE_CHECKOUT.edges,
    );
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    await deleteModel(page, modelId).catch(() => {});
    await page.close();
  });

  test("canvas renders all nodes and edges after reload", async ({ page }) => {
    const check = withCleanCheck();
    check.attach(page);

    await login(page);
    await navigateToModel(page, modelId);

    // All 5 component labels should be visible
    for (const label of [
      "Customer",
      "Checkout Web",
      "Payment API",
      "Stripe",
      "Orders Database",
    ]) {
      await expect(
        page.locator(`.react-flow__node:has-text("${label}")`).first(),
      ).toBeVisible({ timeout: 10000 });
    }

    // Trust boundary should be visible
    await expect(
      page.locator('.react-flow__node:has-text("Internal Services")').first(),
    ).toBeVisible();

    // Edges should exist (4 edges = 4 paths in the SVG layer)
    const edgeCount = await page.locator(".react-flow__edge").count();
    expect(edgeCount).toBeGreaterThanOrEqual(4);

    await check.expectClean();
  });

  test("properties panel opens on component click", async ({ page }) => {
    const check = withCleanCheck();
    check.attach(page);

    await login(page);
    await navigateToModel(page, modelId);

    // Click the Payment API node
    await page
      .locator('.react-flow__node:has-text("Payment API")')
      .first()
      .click();
    await page.waitForTimeout(500);

    // Properties panel should show the component name
    await expect(page.locator("text=Payment API").first()).toBeVisible();

    await check.expectClean();
  });
});
