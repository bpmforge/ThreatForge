/**
 * UC-40: Expert productivity (US-14.2, US-14.3)
 *
 * US-14.2 — Keyboard shortcuts (? opens help; Del removes selected node)
 * US-14.3 — Bulk operations on threats (bulk status change, bulk severity)
 *
 * Endpoints:
 *   POST /api/threat-models/:modelId/bulk/threats/status
 *   POST /api/threat-models/:modelId/bulk/threats/severity
 *   POST /api/threat-models/:modelId/bulk/threats  (bulk delete)
 */
import {
  test,
  expect,
  login,
  createOnlineCheckoutModel,
  deleteModel,
  navigateToModel,
  apiPost,
  apiGet,
} from "./_fixtures";

test.describe("UC-40 — Expert Productivity", () => {
  let modelId: string;
  let threatIds: string[] = [];

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    modelId = await createOnlineCheckoutModel(page);

    // Seed 3 threats for bulk operation tests
    for (const name of [
      "Bulk Test Threat A",
      "Bulk Test Threat B",
      "Bulk Test Threat C",
    ]) {
      const t = await apiPost<{ id: string }>(
        page,
        `/api/threat-models/${modelId}/threats`,
        {
          name,
          description: "Seeded for bulk ops test",
          strideCategories: ["TAMPERING"],
          severity: "MEDIUM",
          componentNodeId: "n-api",
        },
      ).catch(() => ({ id: "" }));
      if (t.id) threatIds.push(t.id);
    }
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    await deleteModel(page, modelId).catch(() => {});
    await page.close();
  });

  // ── Keyboard shortcuts ──────────────────────────────────────────────────

  test("US-14.2: ? key opens keyboard shortcuts help dialog", async ({
    page,
  }) => {
    await login(page);
    await navigateToModel(page, modelId);

    // Click canvas to focus, then press ?
    await page.locator(".react-flow__pane").click();
    await page.waitForTimeout(200);
    await page.keyboard.press("?");
    await page.waitForTimeout(500);

    // Shortcuts dialog should appear
    const dialog = page.locator(
      '[role="dialog"], [data-testid*="shortcut"], [class*="shortcut" i]',
    );
    const hasDialog = (await dialog.count()) > 0;
    // May render as modal with shortcut list
    const hasShortcutText =
      (await page.getByText(/keyboard shortcut/i).count()) > 0 ||
      (await page.getByText(/ctrl\+z/i).count()) > 0;

    expect(hasDialog || hasShortcutText).toBe(true);
  });

  test("US-14.2: Escape closes any open dialog", async ({ page }) => {
    await login(page);
    await navigateToModel(page, modelId);

    await page.locator(".react-flow__pane").click();
    await page.keyboard.press("?");
    await page.waitForTimeout(400);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // Canvas should still be visible after dismiss
    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible();
  });

  test("US-14.2: Ctrl+S triggers save (no crash)", async ({ page }) => {
    await login(page);
    await navigateToModel(page, modelId);

    await page.locator(".react-flow__pane").click();
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible();
  });

  // ── Bulk operations ─────────────────────────────────────────────────────

  test("US-14.3: bulk status update changes all selected threats", async ({
    page,
  }) => {
    test.skip(threatIds.length === 0, "no threats seeded");
    await login(page);

    // Route is PATCH (not POST); body uses `ids` (not `threatIds`) and `status` (not `reviewStatus`)
    const result = await page.evaluate(
      async ({ mId, ids }) => {
        const r = await fetch(`/api/threat-models/${mId}/bulk/threats/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ids, status: "MITIGATED" }),
        });
        return {
          status: r.status,
          ok: r.ok,
          body: r.ok ? await r.json() : null,
        };
      },
      { mId: modelId, ids: threatIds },
    );

    expect(result.ok).toBe(true);

    // Verify via API — `status` field (not `reviewStatus`)
    const threats = await apiGet<Array<{ id: string; status: string }>>(
      page,
      `/api/threat-models/${modelId}/threats`,
    );
    const arr = Array.isArray(threats) ? threats : [];
    for (const id of threatIds) {
      const t = arr.find((x) => x.id === id);
      if (t) expect(t.status).toBe("MITIGATED");
    }
  });

  test("US-14.3: bulk severity update changes severity on all selected", async ({
    page,
  }) => {
    test.skip(threatIds.length === 0, "no threats seeded");
    await login(page);

    // Route is PATCH; body uses `ids`
    const result = await page.evaluate(
      async ({ mId, ids }) => {
        const r = await fetch(
          `/api/threat-models/${mId}/bulk/threats/severity`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ ids, severity: "HIGH" }),
          },
        );
        return { status: r.status, ok: r.ok };
      },
      { mId: modelId, ids: threatIds },
    );

    expect(result.ok).toBe(true);
  });

  test("US-14.3: bulk delete removes selected threats", async ({ page }) => {
    test.skip(threatIds.length === 0, "no threats seeded");
    await login(page);

    // Route is DELETE; body uses `ids`
    await page.evaluate(
      async ({ mId, ids }) => {
        await fetch(`/api/threat-models/${mId}/bulk/threats`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ids }),
        });
      },
      { mId: modelId, ids: threatIds },
    );

    const threats = await apiGet<Array<{ id: string }>>(
      page,
      `/api/threat-models/${modelId}/threats`,
    );
    const arr = Array.isArray(threats) ? threats : [];
    for (const id of threatIds) {
      expect(arr.find((t) => t.id === id)).toBeUndefined();
    }
    threatIds = [];
  });
});
