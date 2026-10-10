import { test, expect, type Page } from "@playwright/test";

/**
 * Repro + regression for the context-menu-near-viewport-bottom bug.
 *
 * A tall context menu opened by a right-click close to the bottom edge must
 * render the WHOLE menu inside the viewport and STAY open — not open, dismiss
 * itself immediately, and let the click fall through to a selection ("opens
 * closes real fast and selects something"). Drives the dev-only
 * /labs/menu-edge scaffold, which uses the same shared Radix ContextMenu the
 * canvas menu does, with a 14-item body matching NodeContextMenu's height.
 *
 * A real Playwright right-click dispatches the full pointer sequence
 * (mousedown → contextmenu → mouseup), which is what reproduces the dismiss —
 * a synthetic `contextmenu` dispatch alone does not.
 */
async function openAndAssertWhole(page: Page, pos: string) {
  const trigger = page.locator(`[data-pos="${pos}"]`);
  await expect(trigger).toBeVisible();
  await trigger.click({ button: "right" });

  const menu = page.locator('[role="menu"]');
  // It opens...
  await expect(menu).toBeVisible({ timeout: 2000 });
  // ...and it STAYS open (the bug: near the bottom it dismisses immediately).
  await page.waitForTimeout(400);
  await expect(menu).toBeVisible();

  // The whole menu is inside the viewport (nothing clipped off the bottom/top).
  const box = await menu.boundingBox();
  const vp = page.viewportSize();
  expect(box).not.toBeNull();
  expect(vp).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp!.height + 1);

  // The last item is reachable — the full menu rendered (or is scrollable to it).
  await expect(menu.getByText("Delete")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
}

test.describe("context menu near the viewport bottom", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/labs/menu-edge");
    await expect(page.locator('[data-pos="very-bottom-4"]')).toBeVisible();
  });

  test("control: mid-screen trigger opens whole menu and stays", async ({
    page,
  }) => {
    await openAndAssertWhole(page, "middle");
  });

  test("near-bottom trigger opens whole menu and stays", async ({ page }) => {
    await openAndAssertWhole(page, "near-bottom-40");
  });

  test("hard-against-bottom trigger opens whole menu and stays", async ({
    page,
  }) => {
    await openAndAssertWhole(page, "very-bottom-4");
  });

  // Regression guard for the fix: swallowing the opening release must NOT break
  // a deliberate item click. Open the menu, then left-click an item, and assert
  // it actually selected (onSelect fired) and the menu closed.
  test("a deliberate item click still selects", async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as { __mlog: string[] }).__mlog = [];
    });
    await page.locator('[data-pos="middle"]').click({ button: "right" });
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();
    await menu.getByText("Edit Properties").click();
    await expect(menu).toBeHidden();
    const mlog = await page.evaluate(
      () => (window as unknown as { __mlog?: string[] }).__mlog ?? [],
    );
    expect(mlog.some((e) => e.includes("SELECTED Edit Properties"))).toBe(true);
  });
});
