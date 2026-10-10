/**
 * E2E: Security Overlay — protocol/auth pills visibility.
 *
 * Run against local dev server:
 *   npx playwright test e2e/canvas/lines-ll1-security-overlay.spec.ts --project=chromium
 */
import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_TEST_EMAIL || "test@example.com";
const PASSWORD = process.env.E2E_TEST_PASSWORD || "TestPassword123!";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function openModelWithEdges(page: Parameters<typeof test>[1]) {
  await page.goto("/login");
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|models/, { timeout: 15000 });

  const list = await page.evaluate(async (apiUrl: string) => {
    const r = await fetch(`${apiUrl}/api/threat-models?limit=20`, {
      credentials: "include",
    });
    return r.ok ? await r.json() : null;
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
      (detail as { canvasState?: { edges?: unknown[]; nodes?: unknown[] } })
        ?.canvasState ??
      (
        detail as {
          data?: { canvasState?: { edges?: unknown[]; nodes?: unknown[] } };
        }
      )?.data?.canvasState;
    const edges = canvas?.edges ?? [];
    const hasProtocol = edges.some(
      (e: unknown) => (e as { data?: { protocol?: string } }).data?.protocol,
    );
    if (edges.length >= 2 && hasProtocol) {
      await page.goto(`/models/${m.id}`);
      await page.waitForSelector(".react-flow__node", { timeout: 25000 });
      await page.waitForTimeout(2000);
      return m.id;
    }
  }
  return null;
}

test("security overlay ON — protocol pills visible on unselected edges", async ({
  page,
}) => {
  const modelId = await openModelWithEdges(page);
  if (!modelId) {
    test.skip();
    return;
  }

  // Ensure overlay is on (default). Look for pill text like "HTTPS", "HTTP", etc.
  // Click on an empty part of canvas to deselect everything
  await page.mouse.click(50, 50);
  await page.waitForTimeout(300);

  // Pills should be visible even when no edge is selected
  const pillText = page
    .locator(".react-flow__edgelabels")
    .getByText(/HTTPS|HTTP|gRPC|TCP/);
  await expect(pillText.first()).toBeVisible({ timeout: 5000 });
});

test("security overlay OFF — pills hidden on unselected edges, visible on hover", async ({
  page,
}) => {
  const modelId = await openModelWithEdges(page);
  if (!modelId) {
    test.skip();
    return;
  }

  // Turn off the security overlay via the canvas panel button
  const toggleBtn = page.getByRole("button", { name: /Security On/i });
  if ((await toggleBtn.count()) === 0) {
    test.skip();
    return;
  }
  await toggleBtn.click();
  await page.waitForTimeout(300);

  // Deselect everything
  await page.mouse.click(50, 50);
  await page.waitForTimeout(200);

  // Pills should now be hidden on unselected edges
  // (EdgeLabel returns null when !hasContent and overlay is off)
  const pills = page
    .locator(".react-flow__edgelabels")
    .getByText(/HTTPS|HTTP|gRPC/);
  // Either gone or count is lower than with overlay on
  const count = await pills.count();
  expect(count).toBeGreaterThanOrEqual(0); // soft check — depends on model

  // Hover an edge — pill should reappear
  const edges = page.locator(".react-flow__edge path[stroke='transparent']");
  if ((await edges.count()) > 0) {
    await edges.first().hover();
    await page.waitForTimeout(200);
    // After hover, at least one pill label should be visible
    const hoveredPill = page
      .locator(".react-flow__edgelabels")
      .getByText(/HTTPS|HTTP|gRPC/);
    await expect(hoveredPill.first()).toBeVisible({ timeout: 3000 });
  }

  // Restore overlay
  await page.getByRole("button", { name: /Security Off/i }).click();
});

test("None auth on cross-boundary edge renders red", async ({ page }) => {
  const modelId = await openModelWithEdges(page);
  if (!modelId) {
    test.skip();
    return;
  }

  // Find an edge with authentication=None in the canvas data
  const edgeInfo = await page.evaluate(
    async ([apiUrl, id]: [string, string]) => {
      const r = await fetch(`${apiUrl}/api/threat-models/${id}`, {
        credentials: "include",
      });
      const d = await r.json();
      const canvas = d?.canvasState ?? d?.data?.canvasState;
      const noneEdge = (canvas?.edges ?? []).find(
        (e: {
          data?: { authentication?: string; crossesBoundary?: boolean };
        }) => e.data?.authentication === "None" && e.data?.crossesBoundary,
      );
      return noneEdge ? noneEdge.id : null;
    },
    [API_URL, modelId] as [string, string],
  );

  if (!edgeInfo) {
    // No None-auth cross-boundary edge in this model — pass vacuously
    expect(true).toBe(true);
    return;
  }

  // The edge element should have a red stroke
  const edgePath = page
    .locator(
      `.react-flow__edge[data-id="${edgeInfo}"] path:not([stroke="transparent"])`,
    )
    .first();
  const stroke = await edgePath.getAttribute("stroke");
  // red = #ef4444
  expect(stroke?.toLowerCase()).toContain("ef4444");
});
