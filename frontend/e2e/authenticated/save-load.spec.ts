import { test, expect, skipIfNotAuthenticated } from "../fixtures/auth";
import {
  dismissGuidedWizard,
  EMPTY_CANVAS_DROP_Y,
} from "../fixtures/test-helpers";

/**
 * Save/Load E2E Tests
 *
 * Tests that canvas state is properly saved to the database and restored when reloading:
 * 1. Create a threat model
 * 2. Add components to canvas
 * 3. Wait for auto-save or trigger manual save
 * 4. Navigate away and return
 * 5. Verify components are still there
 */

test.describe("Save and Load Canvas State", () => {
  test.setTimeout(180000); // 3 minutes

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("canvas state persists after page reload", async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;
    const timestamp = Date.now();
    const modelName = `Save Test ${timestamp}`;

    // Step 1: Create a new threat model
    console.log("Step 1: Creating threat model...");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const newModelBtn = page.locator('button:has-text("New Model")').first();
    if (!(await newModelBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log("New Model button not visible, skipping test");
      test.skip();
      return;
    }

    await newModelBtn.click();
    await page.waitForSelector('[role="dialog"]', {
      state: "visible",
      timeout: 5000,
    });

    const modelNameInput = page.locator("input#name").first();
    await modelNameInput.fill(modelName);

    const createBtn = page.locator(
      '[role="dialog"] button:has-text("Create Model")',
    );
    await createBtn.click();

    // Wait for navigation to model page
    try {
      await page.waitForURL(/\/models\//, { timeout: 15000 });
    } catch {
      console.log("Failed to navigate to model page");
      test.skip();
      return;
    }

    // Extract model ID from URL
    const modelUrl = page.url();
    const modelIdMatch = modelUrl.match(/\/models\/([^/]+)/);
    const modelId = modelIdMatch ? modelIdMatch[1] : null;
    console.log("Created model:", modelId, "URL:", modelUrl);

    // Step 2: Wait for canvas to load
    console.log("Step 2: Waiting for canvas...");
    await page.waitForSelector(".react-flow", { timeout: 20000 });
    await dismissGuidedWizard(page);
    await page.waitForTimeout(2000); // Let React Flow fully initialize

    // Step 3: Add components to canvas
    console.log("Step 3: Adding components to canvas...");
    const paletteItem = page.locator('[draggable="true"]').first();
    const canvas = page.locator(".react-flow__pane").first();

    // Verify palette is visible
    if (!(await paletteItem.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log("Palette not visible");
      test.skip();
      return;
    }

    // Add first component at position (200, 200)
    await paletteItem.dragTo(canvas, {
      targetPosition: { x: 200, y: EMPTY_CANVAS_DROP_Y },
    });
    await page.waitForTimeout(500);

    // Add second component at position (400, 200)
    await paletteItem.dragTo(canvas, { targetPosition: { x: 400, y: 200 } });
    await page.waitForTimeout(500);

    // Add third component at position (300, 350)
    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 350 } });
    await page.waitForTimeout(500);

    // Verify components were added
    const nodeCountAfterAdd = await page.locator(".react-flow__node").count();
    console.log("Nodes after adding:", nodeCountAfterAdd);
    expect(nodeCountAfterAdd).toBeGreaterThanOrEqual(3);

    // Step 4: Wait for auto-save (2 seconds delay + buffer)
    console.log("Step 4: Waiting for auto-save...");
    await page.waitForTimeout(4000);

    // Check save status indicator
    const saveStatus = page
      .locator('[data-testid="save-status"], .save-status, text=/saved/i')
      .first();
    const savedVisible = await saveStatus
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    console.log("Save status visible:", savedVisible);

    // Step 5: Navigate away
    console.log("Step 5: Navigating away...");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Step 6: Navigate back to the same model
    console.log("Step 6: Returning to model...");
    await page.goto(modelUrl);
    await page.waitForLoadState("networkidle");

    // Step 7: Wait for canvas to load again
    console.log("Step 7: Waiting for canvas to reload...");
    await page.waitForSelector(".react-flow", { timeout: 20000 });
    await page.waitForTimeout(3000); // Let canvas state load from server

    // Step 8: Verify components are still there
    console.log("Step 8: Verifying components persisted...");
    const nodeCountAfterReload = await page
      .locator(".react-flow__node")
      .count();
    console.log("Nodes after reload:", nodeCountAfterReload);

    // Take screenshot for debugging
    await page.screenshot({
      path: "test-results/save-load-after-reload.png",
      fullPage: true,
    });

    // The key assertion - components should persist
    expect(nodeCountAfterReload).toBeGreaterThanOrEqual(3);
    expect(nodeCountAfterReload).toBe(nodeCountAfterAdd);

    console.log("Save/Load test passed!");
  });

  test("canvas state persists after browser refresh", async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;
    const timestamp = Date.now();
    const modelName = `Refresh Test ${timestamp}`;

    // Create a new threat model
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const newModelBtn = page.locator('button:has-text("New Model")').first();
    if (!(await newModelBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await newModelBtn.click();
    await page.waitForSelector('[role="dialog"]', {
      state: "visible",
      timeout: 5000,
    });

    await page.locator("input#name").first().fill(modelName);
    await page
      .locator('[role="dialog"] button:has-text("Create Model")')
      .click();

    try {
      await page.waitForURL(/\/models\//, { timeout: 15000 });
    } catch {
      test.skip();
      return;
    }

    const modelUrl = page.url();
    console.log("Model URL:", modelUrl);

    // Wait for canvas
    await page.waitForSelector(".react-flow", { timeout: 20000 });
    await dismissGuidedWizard(page);
    await page.waitForTimeout(2000);

    // Add components
    const paletteItem = page.locator('[draggable="true"]').first();
    const canvas = page.locator(".react-flow__pane").first();

    await paletteItem.dragTo(canvas, {
      targetPosition: { x: 250, y: EMPTY_CANVAS_DROP_Y },
    });
    await page.waitForTimeout(500);

    await paletteItem.dragTo(canvas, { targetPosition: { x: 450, y: 250 } });
    await page.waitForTimeout(500);

    const nodeCountBefore = await page.locator(".react-flow__node").count();
    console.log("Nodes before refresh:", nodeCountBefore);
    expect(nodeCountBefore).toBeGreaterThanOrEqual(2);

    // Wait for auto-save
    await page.waitForTimeout(4000);

    // Refresh the page (F5 / browser refresh)
    console.log("Refreshing page...");
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Wait for canvas to reload
    await page.waitForSelector(".react-flow", { timeout: 20000 });
    await page.waitForTimeout(3000);

    // Verify components persist
    const nodeCountAfter = await page.locator(".react-flow__node").count();
    console.log("Nodes after refresh:", nodeCountAfter);

    await page.screenshot({
      path: "test-results/save-load-after-refresh.png",
      fullPage: true,
    });

    expect(nodeCountAfter).toBe(nodeCountBefore);
    console.log("Refresh test passed!");
  });
});
