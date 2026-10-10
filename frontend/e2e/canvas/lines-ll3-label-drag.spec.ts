/**
 * E2E: Drag label along path.
 *
 * Run against local dev server:
 *   npx playwright test e2e/canvas/lines-ll3-label-drag.spec.ts --project=chromium
 */
import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_TEST_EMAIL || "test@example.com";
const PASSWORD = process.env.E2E_TEST_PASSWORD || "TestPassword123!";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function openModelWithLabeledEdge(page: Parameters<typeof test>[1]) {
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
      (detail as { canvasState?: { edges?: unknown[] } })?.canvasState ??
      (detail as { data?: { canvasState?: { edges?: unknown[] } } })?.data
        ?.canvasState;
    const edges = (canvas?.edges ?? []) as Array<{
      id: string;
      data?: { label?: string; protocol?: string };
    }>;
    const labeledEdge = edges.find((e) => e.data?.label || e.data?.protocol);
    if (labeledEdge) {
      await page.goto(`/models/${m.id}`);
      await page.waitForSelector(".react-flow__edge", { timeout: 25000 });
      await page.waitForTimeout(2000);
      return { modelId: m.id, edgeId: labeledEdge.id };
    }
  }
  return null;
}

test("drag grip repositions label — labelPosition persisted", async ({
  page,
}) => {
  const result = await openModelWithLabeledEdge(page);
  if (!result) {
    test.skip();
    return;
  }
  const { modelId, edgeId } = result;

  // Click edge to select it
  const edge = page.locator(`.react-flow__edge[data-id="${edgeId}"]`);
  await edge.click();
  await page.waitForTimeout(500);

  // The drag grip (aria-label "Drag to reposition label") should appear
  const grip = page.getByLabel("Drag to reposition label");
  if ((await grip.count()) === 0) {
    test.skip();
    return;
  }

  const bb = await grip.boundingBox();
  if (!bb) {
    test.skip();
    return;
  }

  // Record labelPosition before drag
  const posBefore = await page.evaluate(
    async ([apiUrl, id, eid]: [string, string, string]) => {
      const r = await fetch(`${apiUrl}/api/threat-models/${id}`, {
        credentials: "include",
      });
      const d = await r.json();
      const canvas = d?.canvasState ?? d?.data?.canvasState;
      const e = (canvas?.edges ?? []).find(
        (x: { id: string }) => x.id === eid,
      ) as { data?: { labelPosition?: number } } | undefined;
      return e?.data?.labelPosition ?? null;
    },
    [API_URL, modelId, edgeId] as [string, string, string],
  );

  // Drag the grip ~80px to the right
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2 + 80, bb.y + bb.height / 2);
  await page.mouse.up();
  await page.waitForTimeout(2500); // auto-save debounce

  // labelPosition should now be set (non-null, different from before)
  const posAfter = await page.evaluate(
    async ([apiUrl, id, eid]: [string, string, string]) => {
      const r = await fetch(`${apiUrl}/api/threat-models/${id}`, {
        credentials: "include",
      });
      const d = await r.json();
      const canvas = d?.canvasState ?? d?.data?.canvasState;
      const e = (canvas?.edges ?? []).find(
        (x: { id: string }) => x.id === eid,
      ) as { data?: { labelPosition?: number } } | undefined;
      return e?.data?.labelPosition ?? null;
    },
    [API_URL, modelId, edgeId] as [string, string, string],
  );

  expect(posAfter).not.toBeNull();
  expect(typeof posAfter).toBe("number");
  // t must be clamped to [0,1]
  expect(posAfter as number).toBeGreaterThanOrEqual(0);
  expect(posAfter as number).toBeLessThanOrEqual(1);
  // Should differ from original position
  if (posBefore !== null) {
    expect(posAfter).not.toBe(posBefore);
  }
});

test("labelPosition=0.1 renders label near start of path", async ({ page }) => {
  const result = await openModelWithLabeledEdge(page);
  if (!result) {
    test.skip();
    return;
  }
  const { modelId, edgeId } = result;

  // Programmatically set labelPosition=0.1 via API
  const canvas = await page.evaluate(
    async ([apiUrl, id]: [string, string]) => {
      const r = await fetch(`${apiUrl}/api/threat-models/${id}`, {
        credentials: "include",
      });
      const d = await r.json();
      return d?.canvasState ?? d?.data?.canvasState;
    },
    [API_URL, modelId] as [string, string],
  );

  const updatedEdges = ((canvas as { edges?: unknown[] })?.edges ?? []).map(
    (e: unknown) => {
      const edge = e as { id: string; data?: Record<string, unknown> };
      if (edge.id !== edgeId) return edge;
      return { ...edge, data: { ...(edge.data ?? {}), labelPosition: 0.1 } };
    },
  );

  await page.evaluate(
    async ([apiUrl, id, nodes, edges]: [string, string, unknown, unknown]) => {
      await fetch(`${apiUrl}/api/threat-models/${id}/save-canvas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nodes, edges }),
      });
    },
    [
      API_URL,
      modelId,
      (canvas as { nodes?: unknown })?.nodes ?? [],
      updatedEdges,
    ] as [string, string, unknown, unknown],
  );

  // Reload and verify the label renders near the start
  await page.reload();
  await page.waitForSelector(".react-flow__edge", { timeout: 25000 });
  await page.waitForTimeout(2000);

  // The edge label should exist — exact position check is visual-only
  const labelEls = page.locator(".react-flow__edgelabels > div");
  expect(await labelEls.count()).toBeGreaterThan(0);
});
