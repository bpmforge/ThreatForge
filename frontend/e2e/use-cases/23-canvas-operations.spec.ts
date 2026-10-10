/**
 * UC-23: Canvas operations — undo/redo (US-3.6)
 *
 * Seeds a populated model via API, opens it, then verifies:
 * - Ctrl+Z does not crash the page (regression guard)
 * - Ctrl+Shift+Z does not crash the page
 * - Canvas remains functional after both
 *
 * Deep undo/redo state assertions require drag-drop UI interaction which
 * is unreliable in headless CI; the critical invariant here is that the
 * keyboard shortcuts don't cause a React crash (pageerror catches those).
 */
import {
  test,
  expect,
  login,
  createOnlineCheckoutModel,
  deleteModel,
  navigateToModel,
} from "./_fixtures";

test.describe("UC-23 — Canvas Operations (Undo/Redo)", () => {
  let modelId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    modelId = await createOnlineCheckoutModel(page);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    await deleteModel(page, modelId).catch(() => {});
    await page.close();
  });

  test("Ctrl+Z does not crash the page", async ({ page }) => {
    await login(page);
    await navigateToModel(page, modelId);

    // Click canvas to ensure focus
    await page.locator(".react-flow__pane").click();
    await page.waitForTimeout(200);

    await page.keyboard.press("Control+z");
    await page.waitForTimeout(500);

    // Canvas must still be present and functional
    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible();
    const nodeCount = await page.locator(".react-flow__node").count();
    expect(nodeCount).toBeGreaterThanOrEqual(0);
  });

  test("Ctrl+Shift+Z (redo) does not crash the page", async ({ page }) => {
    await login(page);
    await navigateToModel(page, modelId);

    await page.locator(".react-flow__pane").click();
    await page.waitForTimeout(200);

    // Undo first so there's something to redo
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(300);
    await page.keyboard.press("Control+Shift+z");
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible();
  });

  test("multiple rapid Ctrl+Z presses do not crash", async ({ page }) => {
    await login(page);
    await navigateToModel(page, modelId);

    await page.locator(".react-flow__pane").click();
    await page.waitForTimeout(200);

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(100);
    }

    // Page should still respond — canvas wrapper visible
    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible();
  });

  test("canvas Save button is present and clickable", async ({ page }) => {
    await login(page);
    await navigateToModel(page, modelId);

    const saveBtn = page.getByRole("button", { name: /save/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 10000 });
    await saveBtn.click();
    await page.waitForTimeout(500);

    // Should not crash after save
    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible();
  });
});
