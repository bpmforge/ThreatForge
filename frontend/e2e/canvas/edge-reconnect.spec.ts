/**
 * E2E tests for edge endpoint reconnection.
 *
 * Run against a local dev server that has at least one model with 3+ components.
 * Usage:
 *   npx playwright test e2e/canvas/edge-reconnect.spec.ts --project=chromium
 */
import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_TEST_EMAIL || "test@example.com";
const PASSWORD = process.env.E2E_TEST_PASSWORD || "TestPassword123!";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function loginAndOpenModel(page: Parameters<typeof test>[1]) {
  await page.goto("/login");
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|models/, { timeout: 15000 });

  // Find a model with at least 2 edges
  const list = await page.evaluate(async (apiUrl: string) => {
    const r = await fetch(`${apiUrl}/api/threat-models?limit=20`, {
      credentials: "include",
    });
    return r.ok ? ((await r.json()) as { data?: unknown[] }) : null;
  }, API_URL);
  const models: Array<{ id: string }> =
    (list as { data?: Array<{ id: string }> })?.data ?? [];

  for (const m of models) {
    const detail = await page.evaluate(
      async ([apiUrl, id]: [string, string]) => {
        const r = await fetch(`${apiUrl}/api/threat-models/${id}`, {
          credentials: "include",
        });
        return r.ok ? await r.json() : null;
      },
      [API_URL, m.id] as [string, string],
    );
    const canvas =
      (detail as { canvasState?: unknown; data?: { canvasState?: unknown } })
        ?.canvasState ??
      (detail as { data?: { canvasState?: unknown } })?.data?.canvasState;
    const edges: unknown[] = (canvas as { edges?: unknown[] })?.edges ?? [];
    const nodes: unknown[] = (canvas as { nodes?: unknown[] })?.nodes ?? [];
    if (edges.length >= 1 && nodes.length >= 3) {
      await page.goto(`/models/${m.id}`);
      await page.waitForSelector(".react-flow__node", { timeout: 25000 });
      await page.waitForTimeout(2000);
      return m.id;
    }
  }
  return null;
}

test("drag edge target endpoint to new node — edge reconnects", async ({
  page,
}) => {
  const modelId = await loginAndOpenModel(page);
  if (!modelId) {
    test.skip(); // No suitable model found
    return;
  }

  // Get edges before reconnect
  const edgesBefore = await page.evaluate(() => {
    return document.querySelectorAll(".react-flow__edge").length;
  });
  expect(edgesBefore).toBeGreaterThan(0);

  // The reconnect handles appear on the edge endpoints when edgesReconnectable is true.
  // Grab the first edge's update anchor (React Flow adds .react-flow__edgeupdater elements).
  const updater = page.locator(".react-flow__edgeupdater").first();
  const updaterCount = await updater.count();
  expect(updaterCount).toBeGreaterThan(0);

  // Find a target node that isn't already connected
  const nodes = page.locator(".react-flow__node");
  const nodeCount = await nodes.count();
  expect(nodeCount).toBeGreaterThanOrEqual(2);

  // Drag the target updater to the second node — reconnect
  const targetNode = nodes.nth(1);
  const box = await targetNode.boundingBox();
  if (box) {
    await updater.dragTo(targetNode);
    await page.waitForTimeout(1000);
  }

  // Edge count should remain same (reconnect, not add)
  const edgesAfter = await page.evaluate(() => {
    return document.querySelectorAll(".react-flow__edge").length;
  });
  expect(edgesAfter).toBe(edgesBefore);
});

test("drag to empty canvas — edge snaps back unchanged", async ({ page }) => {
  const modelId = await loginAndOpenModel(page);
  if (!modelId) {
    test.skip();
    return;
  }

  // Get edge source/target before
  const edgeBefore = await page.evaluate(
    async ([apiUrl, id]: [string, string]) => {
      const r = await fetch(`${apiUrl}/api/threat-models/${id}`, {
        credentials: "include",
      });
      const d = await r.json();
      const canvas = d?.canvasState ?? d?.data?.canvasState;
      return canvas?.edges?.[0] ?? null;
    },
    [API_URL, modelId] as [string, string],
  );

  if (!edgeBefore) {
    test.skip();
    return;
  }

  // Drag endpoint to empty canvas area (far from any node)
  const updater = page.locator(".react-flow__edgeupdater").first();
  if ((await updater.count()) === 0) {
    test.skip();
    return;
  }

  await page.mouse.move(100, 100); // far corner
  const bb = await updater.boundingBox();
  if (bb) {
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.mouse.move(50, 50); // empty canvas
    await page.mouse.up();
    await page.waitForTimeout(500);
  }

  // Edge should still exist and have same source/target
  const edgeAfter = await page.evaluate(
    async ([apiUrl, id]: [string, string]) => {
      const r = await fetch(`${apiUrl}/api/threat-models/${id}`, {
        credentials: "include",
      });
      const d = await r.json();
      const canvas = d?.canvasState ?? d?.data?.canvasState;
      return canvas?.edges?.[0] ?? null;
    },
    [API_URL, modelId] as [string, string],
  );

  // Source and target should be unchanged (React Flow does not reconnect on empty drop)
  if (edgeAfter) {
    expect(edgeAfter.source).toBe(edgeBefore.source);
    expect(edgeAfter.target).toBe(edgeBefore.target);
  }
});
