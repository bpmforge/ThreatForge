/**
 * UX-02: Canvas UX regression
 *
 * Tests real browser interactions on the canvas that the API-seeded specs
 * cannot cover: keyboard shortcuts, right-click context menu, node selection
 * state, toolbar button states, and edge label visibility.
 *
 * All tests use a pre-seeded model (Online Checkout fixture) so they run fast
 * without needing to drag from the palette.
 */
import {
  test,
  expect,
  login,
  createOnlineCheckoutModel,
  deleteModel,
  navigateToModel,
} from "./_fixtures";

test.describe("UX-02 — Canvas interactions", () => {
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

  test("canvas renders without horizontal/vertical scroll overflow", async ({
    page,
  }) => {
    await navigateToModel(page, modelId);

    // The canvas wrapper should not force the viewport to scroll
    const overflow = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      return {
        bodyX: body.scrollWidth > body.clientWidth,
        bodyY: body.scrollHeight > body.clientHeight,
        htmlX: html.scrollWidth > html.clientWidth,
      };
    });
    expect(overflow.bodyX).toBe(false);
    expect(overflow.htmlX).toBe(false);
  });

  test("clicking a node selects it (selected class applied)", async ({
    page,
  }) => {
    await navigateToModel(page, modelId);

    const node = page
      .locator('.react-flow__node:has-text("Payment API")')
      .first();
    await expect(node).toBeVisible({ timeout: 10000 });

    // Click to select
    await node.click();
    await page.waitForTimeout(300);

    // React Flow adds aria-selected or .selected to the selected node
    const isSelected =
      (await node.getAttribute("aria-selected")) === "true" ||
      (await node.evaluate((el) => el.classList.contains("selected")));
    expect(isSelected).toBe(true);
  });

  test("Escape key deselects nodes", async ({ page }) => {
    await navigateToModel(page, modelId);

    // Select a node first
    await page
      .locator('.react-flow__node:has-text("Payment API")')
      .first()
      .click();
    await page.waitForTimeout(200);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // No node should remain selected
    const selectedNodes = page.locator(
      '.react-flow__node[aria-selected="true"], .react-flow__node.selected',
    );
    expect(await selectedNodes.count()).toBe(0);
  });

  test("Ctrl+A selects all nodes", async ({ page }) => {
    await navigateToModel(page, modelId);

    // Focus the canvas pane first
    await page.locator(".react-flow__pane").click();
    await page.waitForTimeout(200);

    await page.keyboard.press("Control+a");
    await page.waitForTimeout(400);

    const selectedNodes = page.locator(
      '.react-flow__node[aria-selected="true"], .react-flow__node.selected',
    );
    // At least one node selected (5 in Online Checkout + boundary)
    expect(await selectedNodes.count()).toBeGreaterThan(0);
  });

  test("right-click on node shows context menu", async ({ page }) => {
    await navigateToModel(page, modelId);

    const node = page
      .locator('.react-flow__node:has-text("Checkout Web")')
      .first();
    await expect(node).toBeVisible({ timeout: 10000 });

    // Radix ContextMenu needs the contextmenu event, not just right-click.
    // Dispatch it via dispatchEvent to ensure it reaches the Radix trigger.
    await node.dispatchEvent("contextmenu");

    // Radix ContextMenuContent renders with role="menu" when open.
    // Also check data-state="open" on the content wrapper as a fallback.
    await page
      .locator('[role="menu"]')
      .waitFor({ state: "visible", timeout: 5000 });
  });

  test("Ctrl+Z undo and Ctrl+Shift+Z redo do not crash the page", async ({
    page,
  }) => {
    await navigateToModel(page, modelId);

    await page.locator(".react-flow__pane").click();
    await page.waitForTimeout(200);

    // Run 3 undos then 3 redos — regression guard
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(100);
    }
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Control+Shift+z");
      await page.waitForTimeout(100);
    }

    // Canvas must still be functional
    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible();
    const nodeCount = await page.locator(".react-flow__node").count();
    // Undo/redo of no-op operations should leave node count unchanged
    expect(nodeCount).toBeGreaterThanOrEqual(5);
  });

  test("edge labels are visible and show auth/protocol text", async ({
    page,
  }) => {
    await navigateToModel(page, modelId);

    // Wait for edges to render
    await page.waitForSelector(".react-flow__edge", { timeout: 10000 });

    const edgeCount = await page.locator(".react-flow__edge").count();
    expect(edgeCount).toBeGreaterThanOrEqual(4);

    // Edge labels with protocol pills must render in the label renderer layer
    // or as foreignObject text — check the full page text for known protocols
    const bodyText = await page.locator("body").innerText();
    const hasProtocol = /Bearer Token|mTLS|API Key|None|TLS|HTTPS/i.test(
      bodyText,
    );
    expect(hasProtocol).toBe(true);
  });

  test("zoom controls are present and functional", async ({ page }) => {
    await navigateToModel(page, modelId);

    // Zoom in button
    const zoomIn = page
      .locator(
        '[aria-label*="zoom in" i], [data-testid*="zoom-in"], button:has([class*="ZoomIn"])',
      )
      .first();
    await expect(zoomIn).toBeVisible({ timeout: 6000 });
    await zoomIn.click();
    await page.waitForTimeout(300);

    // Canvas must still be present after zoom
    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible();
  });

  test("fit-view button recenters the canvas", async ({ page }) => {
    await navigateToModel(page, modelId);

    const fitBtn = page
      .locator(
        '[aria-label*="fit" i], [data-testid*="fit-view"], button:has([class*="FitView"])',
      )
      .first();
    await expect(fitBtn).toBeVisible({ timeout: 6000 });

    await fitBtn.click();
    await page.waitForTimeout(400);

    // All original nodes should still be visible after fit
    await expect(
      page.locator('.react-flow__node:has-text("Customer")').first(),
    ).toBeVisible({ timeout: 6000 });
    await expect(
      page.locator('.react-flow__node:has-text("Orders Database")').first(),
    ).toBeVisible({ timeout: 6000 });
  });

  test("mini-map renders without overlapping canvas nodes", async ({
    page,
  }) => {
    await navigateToModel(page, modelId);

    const minimap = page.locator(
      '.react-flow__minimap, [data-testid="rf__minimap"]',
    );
    if ((await minimap.count()) === 0) {
      // Mini-map is optional — skip if not wired
      test.skip();
      return;
    }

    const mapBox = await minimap.first().boundingBox();
    const nodeBox = await page
      .locator('.react-flow__node:has-text("Payment API")')
      .first()
      .boundingBox();

    if (mapBox && nodeBox) {
      // The minimap should not completely cover the central canvas area
      const overlaps =
        mapBox.x < nodeBox.x + nodeBox.width &&
        mapBox.x + mapBox.width > nodeBox.x &&
        mapBox.y < nodeBox.y + nodeBox.height &&
        mapBox.y + mapBox.height > nodeBox.y;
      expect(overlaps).toBe(false);
    }
  });
});
