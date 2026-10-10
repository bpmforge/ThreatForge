/**
 * UC-81: AI provider config (list, verify configured)
 * UC-82: Test AI provider connection
 * UC-78: Invite user (API level — verify endpoint exists)
 * UC-10: Sidebar navigation hits all pages
 */
import { test, expect, login, apiGet, withCleanCheck } from "./_fixtures";

const ORG_ID = "cmnuu4qq8000121qfcpeogi0e"; // BPMForge Demo org

test.describe("UC-81/82/78/10 — Admin + Navigation", () => {
  test("UC-81: AI providers endpoint returns configured provider", async ({
    page,
  }) => {
    const check = withCleanCheck();
    check.attach(page);
    await login(page);

    const result = await page.evaluate(async (orgId) => {
      const r = await fetch(`/api/organizations/${orgId}/ai-providers`, {
        credentials: "include",
      });
      if (!r.ok) return { ok: false, status: r.status };
      return { ok: true, data: await r.json() };
    }, ORG_ID);

    expect(result.ok).toBe(true);
    const providers = (
      result as { ok: true; data: { data: { providers: unknown[] } } }
    ).data?.data?.providers;
    expect(providers).toBeTruthy();
    expect(providers.length).toBeGreaterThanOrEqual(1);

    const lmStudio = (providers as Array<Record<string, unknown>>).find(
      (p) => p.type === "LMSTUDIO",
    );
    expect(lmStudio).toBeTruthy();
    expect(lmStudio?.model).toBe("qwen/qwen3-coder-next");

    await check.expectClean();
  });

  test("UC-82: AI availability check returns true", async ({ page }) => {
    const check = withCleanCheck();
    check.attach(page);
    await login(page);

    // Create a temporary model to test AI availability against
    const model = await page.evaluate(async () => {
      const r = await fetch("/api/threat-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: "UC-82 AI test" }),
      });
      const body = await r.json();
      return body.data || body;
    });

    const avail = await apiGet<{ available: boolean }>(
      page,
      `/api/threat-models/${model.id}/ai/available`,
    );
    expect(avail.available).toBe(true);

    // Cleanup
    await page.evaluate(async (id) => {
      await fetch(`/api/threat-models/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
    }, model.id);

    await check.expectClean();
  });

  test("UC-78: invitations endpoint exists", async ({ page }) => {
    const check = withCleanCheck();
    check.attach(page);
    await login(page);

    // Just verify the endpoint doesn't 404
    const result = await page.evaluate(async (orgId) => {
      const r = await fetch(`/api/organizations/${orgId}/invitations`, {
        credentials: "include",
      });
      return { status: r.status };
    }, ORG_ID);

    // 200 (has invitations) or 403 (permission) are both valid — not 404
    expect(result.status).not.toBe(404);

    await check.expectClean();
  });

  test("UC-10: sidebar navigation — all key pages load", async ({ page }) => {
    test.setTimeout(120_000);
    const check = withCleanCheck();
    check.attach(page);
    await login(page);

    const pages = [
      { path: "/dashboard", label: "Dashboard" },
      { path: "/templates", label: "Templates" },
      { path: "/analytics/risk", label: "Risk" },
      { path: "/analytics/compliance", label: "Compliance" },
      { path: "/profile", label: "Profile" },
      { path: "/admin", label: "Admin" },
    ];

    for (const p of pages) {
      await page.goto(p.path);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      // Page should not be blank
      const bodyLen = (await page.locator("body").innerText()).length;
      expect(bodyLen, `${p.label} page should have content`).toBeGreaterThan(
        20,
      );
    }

    await check.expectClean();
  });
});
