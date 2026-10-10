/**
 * Yjs / canvas round-trip smoke test for new ConnectionData optional fields.
 *
 * Verifies that the 7 optional fields added in W0 survive a full round-trip:
 *   store → save-canvas API → DB → page reload → GET model API
 *
 * This is a dev-only test. Run it against a local server with at least one
 * model that has edges. It does NOT run in CI.
 *
 * Usage:
 *   npx playwright test e2e/smoke/yjs-edge-fields.spec.ts --project=chromium
 */
import { test, expect } from "@playwright/test";

const EMAIL = "demo@example.com";
const PASSWORD = "TestPass123!";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// Dev-only (hard-coded local demo user, see header). Never meaningful against
// a remote target, where that account does not exist.
test.skip(
  !!process.env.TOUR_BASE_URL,
  "local-only round-trip test; skipped against a remote TOUR_BASE_URL",
);

test.describe("ConnectionData W0 fields — round-trip", () => {
  test("new optional edge fields survive save-canvas → reload", async ({
    page,
  }) => {
    // 1. Login
    await page.goto("/login");
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|models/, { timeout: 15000 });

    // 2. Find a model with edges via the API
    const listResp = await page.evaluate(async (apiUrl: string) => {
      const r = await fetch(`${apiUrl}/api/threat-models?limit=10`, {
        credentials: "include",
      });
      return r.ok ? await r.json() : null;
    }, API_URL);

    expect(listResp, "Should get model list").not.toBeNull();
    const models: Array<{ id: string }> = listResp?.data ?? listResp ?? [];
    expect(models.length, "Need at least one model").toBeGreaterThan(0);

    // 3. Pick the first model and load its canvas state
    let modelId: string | null = null;
    let testEdgeId: string | null = null;
    let originalNodes: unknown[] = [];
    let originalEdges: unknown[] = [];

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
      const canvas = detail?.canvasState ?? detail?.data?.canvasState;
      const edges: Array<{ id: string }> = canvas?.edges ?? [];
      if (edges.length > 0) {
        modelId = m.id;
        testEdgeId = edges[0].id;
        originalNodes = canvas?.nodes ?? [];
        originalEdges = edges;
        break;
      }
    }

    expect(modelId, "Need a model with at least one edge").not.toBeNull();
    expect(testEdgeId).not.toBeNull();

    // 4. Inject W0 optional fields onto the first edge
    const patchedEdges = originalEdges.map(
      (e: { id: string; data?: Record<string, unknown> }) => {
        if (e.id !== testEdgeId) return e;
        return {
          ...e,
          data: {
            ...(e.data ?? {}),
            waypoints: [{ x: 100, y: 200, manual: true }],
            labelPosition: 0.25,
            labelOffset: "above",
            labelSize: "sm",
            strokePattern: "dashed",
            cornerRadius: 8,
            endpoint: { start: "none", end: "diamond" },
            lineVariant: "single",
          },
        };
      },
    );

    const saveOk = await page.evaluate(
      async ([apiUrl, id, nodes, edges]: [
        string,
        string,
        unknown[],
        unknown[],
      ]) => {
        const r = await fetch(`${apiUrl}/api/threat-models/${id}/save-canvas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ nodes, edges }),
        });
        return r.ok;
      },
      [API_URL, modelId, originalNodes, patchedEdges] as [
        string,
        string,
        unknown[],
        unknown[],
      ],
    );

    expect(saveOk, "save-canvas should succeed").toBe(true);

    // 5. Reload the model page to simulate a fresh client connecting via Yjs
    await page.goto(`/models/${modelId}`);
    await page.waitForSelector(".react-flow__node", { timeout: 25000 });
    await page.waitForTimeout(3000); // Yjs sync + auto-save debounce

    // 6. Read back the canvas state from the API and assert fields survived
    const reloaded = await page.evaluate(
      async ([apiUrl, id]: [string, string]) => {
        const r = await fetch(`${apiUrl}/api/threat-models/${id}`, {
          credentials: "include",
        });
        return r.ok ? await r.json() : null;
      },
      [API_URL, modelId] as [string, string],
    );

    const reloadedCanvas = reloaded?.canvasState ?? reloaded?.data?.canvasState;
    const reloadedEdge = (reloadedCanvas?.edges ?? []).find(
      (e: { id: string }) => e.id === testEdgeId,
    );

    expect(reloadedEdge, "Test edge should still exist").toBeDefined();
    const d = reloadedEdge?.data ?? {};

    expect(
      d.waypoints?.[0]?.manual,
      "waypoint.manual survives round-trip",
    ).toBe(true);
    expect(d.waypoints?.[0]?.x, "waypoint.x survives").toBe(100);
    expect(d.labelPosition, "labelPosition survives").toBe(0.25);
    expect(d.labelOffset, "labelOffset survives").toBe("above");
    expect(d.labelSize, "labelSize survives").toBe("sm");
    expect(d.strokePattern, "strokePattern survives").toBe("dashed");
    expect(d.cornerRadius, "cornerRadius survives").toBe(8);
    expect(d.endpoint?.start, "endpoint.start survives").toBe("none");
    expect(d.endpoint?.end, "endpoint.end survives").toBe("diamond");
    expect(d.lineVariant, "lineVariant survives").toBe("single");
  });
});
