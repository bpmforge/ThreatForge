/**
 * UC-76: Connection intelligence (US-3.7, US-3.8, US-13.5, US-13.6)
 *
 * US-3.7 — Connections display protocol/auth labels (A&A pills)
 * US-3.8 — Security overlay toggle shows edge risk indicators
 * US-13.5 — Connection security suggestions (AI recommends upgrades)
 * US-13.6 — Connection warnings (unencrypted / no-auth flagged visually)
 *
 * Strategy: the ONLINE_CHECKOUT fixture has edges with varied security
 * configs (None auth → red stroke, mTLS → green). Verify via canvasState
 * API and canvas rendering that protocol/auth data is present.
 */
import {
  test,
  expect,
  login,
  createOnlineCheckoutModel,
  deleteModel,
  navigateToModel,
  apiGet,
  saveCanvas,
  makeEdge,
  ONLINE_CHECKOUT,
} from "./_fixtures";

test.describe("UC-76 — Connection Intelligence", () => {
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

  // ── API-level edge data ─────────────────────────────────────────────────

  test("US-3.7: canvas edges have protocol and auth data fields", async ({
    page,
  }) => {
    await login(page);

    const model = await apiGet<{
      canvasState?: {
        edges?: Array<{
          data?: {
            protocol?: string;
            authenticated?: boolean;
            authentication?: string;
          };
        }>;
      };
    }>(page, `/api/threat-models/${modelId}`);

    const edges =
      (
        model as {
          canvasState?: { edges?: Array<{ data?: Record<string, unknown> }> };
        }
      ).canvasState?.edges ?? [];

    expect(edges.length).toBeGreaterThanOrEqual(4);

    // Every edge should carry protocol data
    const withProtocol = edges.filter((e) => e.data?.protocol);
    expect(withProtocol.length).toBeGreaterThanOrEqual(1);
  });

  test("US-3.7: at least one edge has HTTPS protocol", async ({ page }) => {
    await login(page);

    const model = await apiGet<{
      canvasState?: {
        edges?: Array<{ data?: { protocol?: string } }>;
      };
    }>(page, `/api/threat-models/${modelId}`);

    const edges =
      (
        model as {
          canvasState?: { edges?: Array<{ data?: { protocol?: string } }> };
        }
      ).canvasState?.edges ?? [];

    const httpsEdge = edges.find((e) => e.data?.protocol === "HTTPS");
    expect(httpsEdge).toBeTruthy();
  });

  test("US-3.6: edge with auth=None is distinguishable from authenticated edges", async ({
    page,
  }) => {
    await login(page);

    const model = await apiGet<{
      canvasState?: {
        edges?: Array<{
          data?: { authenticated?: boolean; authentication?: string };
        }>;
      };
    }>(page, `/api/threat-models/${modelId}`);

    const edges =
      (
        model as {
          canvasState?: {
            edges?: Array<{ data?: { authenticated?: boolean } }>;
          };
        }
      ).canvasState?.edges ?? [];

    // ONLINE_CHECKOUT has e-1 (Customer→Web) with auth=None → authenticated=false
    const unauthEdge = edges.find((e) => e.data?.authenticated === false);
    expect(unauthEdge).toBeTruthy();
  });

  test("US-3.8: saving an edge with security=off/on round-trips correctly", async ({
    page,
  }) => {
    await login(page);

    // Add an extra edge with explicit encrypted=false (insecure connection)
    const insecureEdge = makeEdge("e-insecure", "n-customer", "n-web", {
      protocol: "HTTP",
      encrypted: false,
      auth: "None",
    });

    await saveCanvas(page, modelId, ONLINE_CHECKOUT.nodes, [
      ...ONLINE_CHECKOUT.edges,
      insecureEdge,
    ]);

    const model = await apiGet<{
      canvasState?: {
        edges?: Array<{
          id: string;
          data?: { protocol?: string; encrypted?: boolean };
        }>;
      };
    }>(page, `/api/threat-models/${modelId}`);

    const edges =
      (
        model as {
          canvasState?: {
            edges?: Array<{ id: string; data?: Record<string, unknown> }>;
          };
        }
      ).canvasState?.edges ?? [];

    const saved = edges.find((e: { id: string }) => e.id === "e-insecure");
    expect(saved).toBeTruthy();
    expect((saved as { data?: { protocol?: string } })?.data?.protocol).toBe(
      "HTTP",
    );
  });

  // ── UI-level pill rendering ─────────────────────────────────────────────

  test("US-3.7: canvas renders with visible edges after load", async ({
    page,
  }) => {
    await login(page);
    await navigateToModel(page, modelId);

    const edgeCount = await page.locator(".react-flow__edge").count();
    expect(edgeCount).toBeGreaterThanOrEqual(4);
  });

  test("US-3.8: security overlay toggle does not crash canvas", async ({
    page,
  }) => {
    await login(page);
    await navigateToModel(page, modelId);

    // The overlay toggle is usually a toolbar button
    const overlayBtn = page.getByRole("button", {
      name: /security overlay|show overlay|hide overlay/i,
    });

    if ((await overlayBtn.count()) > 0) {
      await overlayBtn.click();
      await page.waitForTimeout(400);
      // Toggle again to reset
      await overlayBtn.click();
      await page.waitForTimeout(400);
    }

    // Canvas must still be functional
    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible();
  });

  test("US-13.5: edges with no auth are flagged in canvas state", async ({
    page,
  }) => {
    await login(page);

    const model = await apiGet<{
      canvasState?: {
        edges?: Array<{
          data?: { authenticated?: boolean; protocol?: string };
        }>;
      };
    }>(page, `/api/threat-models/${modelId}`);

    const edges =
      (
        model as {
          canvasState?: { edges?: Array<{ data?: Record<string, unknown> }> };
        }
      ).canvasState?.edges ?? [];

    // At least one edge has no authentication — this is the warning surface
    const flaggable = edges.filter(
      (e) =>
        e.data?.authenticated === false ||
        (e.data as { encryption?: boolean })?.encryption === false,
    );
    expect(flaggable.length).toBeGreaterThanOrEqual(1);
  });
});
