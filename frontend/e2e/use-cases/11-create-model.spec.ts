/**
 * UC-11: Create new threat model from dashboard → canvas loads.
 */
import {
  test,
  expect,
  login,
  deleteAllModels,
  withCleanCheck,
} from "./_fixtures";

test.describe("UC-11 — Create Model", () => {
  test("dialog creates model and navigates to canvas", async ({ page }) => {
    const check = withCleanCheck();
    check.attach(page);

    await login(page);
    await deleteAllModels(page);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);

    // Click the CTA (empty state or "New Model" button)
    const cta = page
      .getByRole("button", {
        name: /create your first threat model|new model/i,
      })
      .first();
    await cta.click();
    await page.waitForSelector('input[id="name"]', { state: "visible" });

    // Fill name and submit
    await page.fill('input[id="name"]', "UC-11 Test Model");
    await page.getByRole("button", { name: /create model/i }).click();

    // Should navigate to canvas
    await page.waitForURL("**/models/**", { timeout: 15000 });
    await page.waitForSelector('[data-testid="rf__wrapper"]', {
      state: "visible",
      timeout: 15000,
    });

    // Canvas should have the palette visible
    await expect(
      page.locator('[draggable="true"]:has-text("Actor")'),
    ).toBeVisible();

    // Verify model exists via API
    const modelId = page.url().match(/\/models\/([^/?#]+)/)?.[1];
    expect(modelId).toBeTruthy();

    const model = await page.evaluate(async (id) => {
      const r = await fetch(`/api/threat-models/${id}`, {
        credentials: "include",
      });
      return r.ok ? await r.json() : null;
    }, modelId);
    expect(model?.data?.name || model?.name).toBe("UC-11 Test Model");

    await check.expectClean();
  });
});
