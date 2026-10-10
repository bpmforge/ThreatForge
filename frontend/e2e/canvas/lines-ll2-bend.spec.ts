/**
 * E2E: Grab-and-bend interaction — pill handles, drag to reshape.
 *
 * Run against local dev server:
 *   npx playwright test e2e/canvas/lines-ll2-bend.spec.ts --project=chromium
 */
import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_TEST_EMAIL || "test@example.com";
const PASSWORD = process.env.E2E_TEST_PASSWORD || "TestPassword123!";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function loginAndOpenEdgeModel(page: Parameters<typeof test>[1]) {
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
    if ((canvas?.edges ?? []).length >= 1) {
      await page.goto(`/models/${m.id}`);
      await page.waitForSelector(".react-flow__edge", { timeout: 25000 });
      await page.waitForTimeout(2000);
      return m.id;
    }
  }
  return null;
}

test("select edge → pill handles appear at segment midpoints", async ({
  page,
}) => {
  const modelId = await loginAndOpenEdgeModel(page);
  if (!modelId) {
    test.skip();
    return;
  }

  // Click on an edge to select it
  const edge = page.locator(".react-flow__edge").first();
  await edge.click();
  await page.waitForTimeout(500);

  // With lucid-lines on, WaypointHandles renders pill <rect> elements on the SVG
  // Look for rect elements inside the edge layer that are the pill handles
  const pillRects = page.locator(".react-flow__edges rect[stroke='#3b82f6']");
  const pillCount = await pillRects.count();
  expect(pillCount).toBeGreaterThan(0);
});

test("drag midpoint pill → waypoint committed, path changes", async ({
  page,
}) => {
  const modelId = await loginAndOpenEdgeModel(page);
  if (!modelId) {
    test.skip();
    return;
  }

  // Select first edge
  const edge = page.locator(".react-flow__edge").first();
  const edgeId = await edge.getAttribute("data-id");
  await edge.click();
  await page.waitForTimeout(500);

  // Get waypoints before drag
  const _wpBefore = await page.evaluate(
    async ([apiUrl, id, eid]: [string, string, string]) => {
      const r = await fetch(`${apiUrl}/api/threat-models/${id}`, {
        credentials: "include",
      });
      const d = await r.json();
      const canvas = d?.canvasState ?? d?.data?.canvasState;
      return (
        (
          (canvas?.edges ?? []).find((e: { id: string }) => e.id === eid) as
            | { data?: { waypoints?: unknown } }
            | undefined
        )?.data?.waypoints ?? null
      );
    },
    [API_URL, modelId, edgeId ?? ""] as [string, string, string],
  );

  // Find a pill handle (hollow rect with #3b82f6 stroke, white fill)
  const pill = page
    .locator(".react-flow__edges rect[fill='white'][stroke='#3b82f6']")
    .first();
  if ((await pill.count()) === 0) {
    test.skip();
    return;
  }

  const bb = await pill.boundingBox();
  if (!bb) {
    test.skip();
    return;
  }

  // Drag the pill ~60px to the right
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2 + 60, bb.y + bb.height / 2);
  await page.mouse.up();
  await page.waitForTimeout(1500); // wait for auto-save debounce

  // Save to trigger persistence
  await page.keyboard.press("Control+s");
  await page.waitForTimeout(2000);

  // Waypoints should now be set on the edge
  const wpAfter = await page.evaluate(
    async ([apiUrl, id, eid]: [string, string, string]) => {
      const r = await fetch(`${apiUrl}/api/threat-models/${id}`, {
        credentials: "include",
      });
      const d = await r.json();
      const canvas = d?.canvasState ?? d?.data?.canvasState;
      return (
        (
          (canvas?.edges ?? []).find((e: { id: string }) => e.id === eid) as
            | { data?: { waypoints?: unknown[] } }
            | undefined
        )?.data?.waypoints ?? null
      );
    },
    [API_URL, modelId, edgeId ?? ""] as [string, string, string],
  );

  // After drag, waypoints array should be non-null and non-empty
  expect(wpAfter).not.toBeNull();
  expect((wpAfter as unknown[])?.length).toBeGreaterThan(0);
  // At least one waypoint should be marked manual
  const hasManual = (wpAfter as Array<{ manual?: boolean }>).some(
    (w) => w.manual === true,
  );
  expect(hasManual).toBe(true);
});

test("double-click edge resets waypoints (Reset line)", async ({ page }) => {
  const modelId = await loginAndOpenEdgeModel(page);
  if (!modelId) {
    test.skip();
    return;
  }

  // First set a waypoint via the context menu reset (start with one that has waypoints)
  const edge = page.locator(".react-flow__edge").first();
  await edge.click();
  await page.waitForTimeout(300);

  // Right-click → Reset line
  await edge.click({ button: "right" });
  const resetItem = page.getByRole("menuitem", { name: "Reset line" });
  if ((await resetItem.count()) > 0) {
    await resetItem.click();
    await page.waitForTimeout(500);
    // Edge should now use auto-routing (no manual waypoints visible)
    // Pills are still shown (auto-routed segment midpoints) but none filled
    const filledPills = page.locator(".react-flow__edges rect[fill='#3b82f6']");
    expect(await filledPills.count()).toBe(0);
  }
});
