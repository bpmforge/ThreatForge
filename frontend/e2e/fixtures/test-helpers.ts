import { Page, expect } from "@playwright/test";

/**
 * E2E Test Helpers
 *
 * Common utilities for Playwright E2E tests.
 */

/**
 * Wait for React Flow canvas to be fully initialized
 */
export async function waitForCanvas(page: Page, timeout = 10000) {
  await page.waitForSelector(".react-flow", { timeout });
  await page.waitForSelector(".react-flow__viewport", { timeout });
  // Give React Flow time to initialize internal state
  await page.waitForTimeout(500);
}

/**
 * Get the React Flow pane element (for clicks/drags)
 */
export async function getCanvasPane(page: Page) {
  return page.locator(".react-flow__pane");
}

/**
 * Get all nodes on the canvas
 */
export async function getNodes(page: Page) {
  return page.locator(".react-flow__node");
}

/**
 * Get all edges on the canvas
 */
export async function getEdges(page: Page) {
  return page.locator(".react-flow__edge");
}

/**
 * Get node by its data-id attribute
 */
export async function getNodeById(page: Page, nodeId: string) {
  return page.locator(`.react-flow__node[data-id="${nodeId}"]`);
}

/**
 * Get node by its label text
 */
export async function getNodeByLabel(page: Page, label: string) {
  return page.locator(`.react-flow__node:has-text("${label}")`);
}

/**
 * Select a node by clicking it
 */
export async function selectNode(page: Page, nodeId: string) {
  const node = await getNodeById(page, nodeId);
  await node.click();
}

/**
 * Multi-select nodes by shift-clicking
 */
export async function multiSelectNodes(page: Page, nodeIds: string[]) {
  for (let i = 0; i < nodeIds.length; i++) {
    const node = await getNodeById(page, nodeIds[i]);
    if (i === 0) {
      await node.click();
    } else {
      await node.click({ modifiers: ["Shift"] });
    }
  }
}

/**
 * Drag a node to a new position
 */
export async function dragNode(
  page: Page,
  nodeId: string,
  deltaX: number,
  deltaY: number,
) {
  const node = await getNodeById(page, nodeId);
  const box = await node.boundingBox();
  if (!box) throw new Error(`Node ${nodeId} not found`);

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + deltaX,
    box.y + box.height / 2 + deltaY,
  );
  await page.mouse.up();
}

/**
 * Create a connection between two nodes
 */
export async function connectNodes(
  page: Page,
  sourceNodeId: string,
  targetNodeId: string,
) {
  const sourceNode = await getNodeById(page, sourceNodeId);
  const targetNode = await getNodeById(page, targetNodeId);

  const sourceHandle = sourceNode.locator(".react-flow__handle-right");
  const targetHandle = targetNode.locator(".react-flow__handle-left");

  await sourceHandle.dragTo(targetHandle);
}

/**
 * Delete selected nodes/edges
 */
export async function deleteSelected(page: Page) {
  await page.keyboard.press("Delete");
}

/**
 * Undo last action
 */
export async function undo(page: Page) {
  await page.keyboard.press("Control+z");
}

/**
 * Redo last undone action
 */
export async function redo(page: Page) {
  await page.keyboard.press("Control+Shift+z");
}

/**
 * Select all nodes
 */
export async function selectAll(page: Page) {
  await page.keyboard.press("Control+a");
}

/**
 * Copy selected nodes
 */
export async function copy(page: Page) {
  await page.keyboard.press("Control+c");
}

/**
 * Paste copied nodes
 */
export async function paste(page: Page) {
  await page.keyboard.press("Control+v");
}

/**
 * Zoom canvas in
 */
export async function zoomIn(page: Page) {
  const zoomInBtn = page.locator(".react-flow__controls-zoomin");
  await zoomInBtn.click();
}

/**
 * Zoom canvas out
 */
export async function zoomOut(page: Page) {
  const zoomOutBtn = page.locator(".react-flow__controls-zoomout");
  await zoomOutBtn.click();
}

/**
 * Fit view to show all nodes
 */
export async function fitView(page: Page) {
  const fitViewBtn = page.locator(".react-flow__controls-fitview");
  await fitViewBtn.click();
}

/**
 * Open context menu at position
 */
export async function openContextMenu(page: Page, x: number, y: number) {
  const pane = await getCanvasPane(page);
  await pane.click({ button: "right", position: { x, y } });
}

/**
 * Open context menu on a node
 */
export async function openNodeContextMenu(page: Page, nodeId: string) {
  const node = await getNodeById(page, nodeId);
  await node.click({ button: "right" });
}

/**
 * Drag item from palette to canvas
 */
export async function dragFromPalette(
  page: Page,
  itemSelector: string,
  canvasX: number,
  canvasY: number,
) {
  const paletteItem = page.locator(itemSelector);
  const pane = await getCanvasPane(page);

  await paletteItem.dragTo(pane, {
    targetPosition: { x: canvasX, y: canvasY },
  });
}

/**
 * Get current viewport transform
 */
export async function getViewportTransform(page: Page) {
  const viewport = page.locator(".react-flow__viewport");
  return viewport.evaluate((el) => {
    const transform = el.style.transform;
    const match = transform.match(
      /translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/,
    );
    if (match) {
      return {
        x: parseFloat(match[1]),
        y: parseFloat(match[2]),
        zoom: parseFloat(match[3]),
      };
    }
    return null;
  });
}

/**
 * Verify node exists at approximate position
 */
export async function expectNodeAtPosition(
  page: Page,
  nodeId: string,
  expectedX: number,
  expectedY: number,
  tolerance = 50,
) {
  const node = await getNodeById(page, nodeId);
  const box = await node.boundingBox();

  expect(box).not.toBeNull();
  if (box) {
    expect(Math.abs(box.x - expectedX)).toBeLessThan(tolerance);
    expect(Math.abs(box.y - expectedY)).toBeLessThan(tolerance);
  }
}

/**
 * Verify connection exists between nodes
 */
export async function expectConnection(
  page: Page,
  sourceNodeId: string,
  targetNodeId: string,
) {
  const edge = page.locator(
    `.react-flow__edge[data-source="${sourceNodeId}"][data-target="${targetNodeId}"]`,
  );
  expect(await edge.count()).toBeGreaterThan(0);
}

/**
 * Wait for node count to reach expected value
 */
export async function waitForNodeCount(
  page: Page,
  expectedCount: number,
  timeout = 5000,
) {
  await expect(page.locator(".react-flow__node")).toHaveCount(expectedCount, {
    timeout,
  });
}

/**
 * Wait for edge count to reach expected value
 */
export async function waitForEdgeCount(
  page: Page,
  expectedCount: number,
  timeout = 5000,
) {
  await expect(page.locator(".react-flow__edge")).toHaveCount(expectedCount, {
    timeout,
  });
}

/**
 * Check if we're on the login page (unauthenticated)
 */
export function isLoginPage(page: Page) {
  return page.url().includes("/login");
}

/**
 * Skip test if not authenticated
 */
export async function skipIfUnauthenticated(page: Page) {
  if (isLoginPage(page)) {
    return true;
  }
  return false;
}
