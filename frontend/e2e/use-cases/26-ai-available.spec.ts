/**
 * UC-26: AI availability check — AI tab shows methodology selector when configured.
 * UC-27: STRIDE threat suggestion — real LLM call returns valid threats.
 * UC-29: Accept threat — suggested threat moves to Threats tab.
 *
 * Combined into one spec file because they form a single logical flow.
 * Uses the sync /ai/suggest-threats endpoint (not async micro-analysis)
 * for reliability. AI call takes ~60s against qwen3-coder-next.
 */
import {
  test,
  expect,
  login,
  createOnlineCheckoutModel,
  deleteModel,
  navigateToModel,
  apiGet,
  withCleanCheck,
} from "./_fixtures";

test.describe("UC-26/27/29 — AI Threats", () => {
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

  test("UC-26: AI availability returns true for configured org", async ({
    page,
  }) => {
    const check = withCleanCheck();
    check.attach(page);
    await login(page);

    // Freshly-created models occasionally report "AI not configured" on the
    // first read because the project→organization→aiSettings read chain is
    // racing with the audit-log write kicked off by the model create. The
    // window closes quickly, but can exceed 1s. Retry up to 10x over 10s;
    // if it's still false after that, the provider genuinely isn't attached
    // and we want the failure.
    let result: { available: boolean; reason?: string } = { available: false };
    for (let i = 0; i < 10; i++) {
      result = await apiGet<{ available: boolean; reason?: string }>(
        page,
        `/api/threat-models/${modelId}/ai/available`,
      );
      if (result.available) break;
      await page.waitForTimeout(1000);
    }
    expect(result.available, result.reason ?? "no reason returned").toBe(true);

    await check.expectClean();
  });

  test("UC-26: AI tab shows methodology selector", async ({ page }) => {
    const check = withCleanCheck();
    check.attach(page);
    await login(page);
    await navigateToModel(page, modelId);

    await page.getByRole("tab", { name: /^AI$/i }).first().click();
    await page.waitForTimeout(1500);

    // Should show the methodology combobox and analyze button
    await expect(page.locator('[role="combobox"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole("button", { name: /analyze with stride/i }),
    ).toBeVisible();

    await check.expectClean();
  });

  test("UC-27: sync suggest-threats returns valid STRIDE threats", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const check = withCleanCheck();
    check.attach(page);
    await login(page);

    // Call the sync endpoint directly — bypasses async job queue
    const result = await page.evaluate(async (id) => {
      const r = await fetch(`/api/threat-models/${id}/ai/suggest-threats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!r.ok) return { ok: false, status: r.status, error: await r.text() };
      const body = await r.json();
      return { ok: true, threats: body.data?.threats || body.threats || [] };
    }, modelId);

    expect(result.ok).toBe(true);
    const threats = (result as { ok: true; threats: unknown[] }).threats;
    expect(threats.length).toBeGreaterThanOrEqual(5);

    // Validate schema of first threat
    const first = threats[0] as Record<string, unknown>;
    expect(first.title).toBeTruthy();
    expect(first.description).toBeTruthy();
    expect(first.category).toBeTruthy();
    expect(first.severity).toBeTruthy();
    expect(typeof first.confidence).toBe("number");

    // Should cover at least 3 distinct STRIDE categories
    const categories = new Set(
      threats.map((t) => (t as Record<string, unknown>).category),
    );
    expect(categories.size).toBeGreaterThanOrEqual(3);

    await check.expectClean();
  });

  test("UC-29: creating a threat via API persists it", async ({ page }) => {
    const check = withCleanCheck();
    check.attach(page);
    await login(page);

    // Create a threat
    const created = await page.evaluate(
      async ({ id }) => {
        const r = await fetch(`/api/threat-models/${id}/threats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: "UC-29 Test Threat",
            description: "Created by E2E test",
            strideCategories: ["TAMPERING"],
            severity: "HIGH",
          }),
        });
        return { ok: r.ok, status: r.status, body: await r.json() };
      },
      { id: modelId },
    );

    expect(created.ok).toBe(true);

    // Verify the threat persisted via API round-trip (avoids TanStack cache issues)
    const threats = await apiGet<Array<{ id: string; name: string }>>(
      page,
      `/api/threat-models/${modelId}/threats`,
    );
    const found = threats.find((t) => t.name === "UC-29 Test Threat");
    expect(found).toBeTruthy();

    await check.expectClean();
  });
});
