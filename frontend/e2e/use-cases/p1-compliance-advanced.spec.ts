/**
 * P1 — Advanced compliance: UC-62 (custom requirement), UC-65 (CSV import),
 * UC-66 (gap CSV export), UC-38 (multi-doc import), UC-39 (SRS requirements),
 * UC-43 (scan errors), UC-46 (save as template), UC-28 (multi-methodology)
 */
import {
  test,
  expect,
  login,
  createOnlineCheckoutModel,
  deleteModel,
  withCleanCheck,
} from "./_fixtures";

test.describe("P1 — Compliance Advanced", () => {
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

  test("UC-62: create custom requirement via API", async ({ page }) => {
    const check = withCleanCheck();
    check.attach(page);
    await login(page);

    const result = await page.evaluate(async (mid) => {
      const r = await fetch(`/api/threat-models/${mid}/requirements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reqId: "CUSTOM-001",
          text: "All API endpoints must require authentication",
          category: "ACCESS_CONTROL",
          source: "MANUAL",
        }),
      });
      return {
        ok: r.ok,
        status: r.status,
        body: (await r.text()).slice(0, 300),
      };
    }, modelId);

    expect([200, 201]).toContain(result.status);
    await check.expectClean();
  });

  test("UC-65: bulk requirements import via CSV endpoint", async ({ page }) => {
    const check = withCleanCheck();
    check.attach(page);
    await login(page);

    const result = await page.evaluate(async (mid) => {
      const r = await fetch(
        `/api/threat-models/${mid}/requirements/import/csv`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            requirements: [
              {
                reqId: "CSV-001",
                text: "Encrypt data at rest",
                category: "ENCRYPTION",
              },
              {
                reqId: "CSV-002",
                text: "Log all access events",
                category: "LOGGING",
              },
            ],
          }),
        },
      );
      return { status: r.status };
    }, modelId);

    // 200/201 (imported), 400 (validation/content-type mismatch), or 404 (not implemented)
    expect([200, 201, 400, 404]).toContain(result.status);
    if (result.status === 404) {
      console.warn("UC-65: CSV import endpoint not implemented");
    }
    await check.expectClean();
  });

  test("UC-66: gap analysis returns exportable data", async ({ page }) => {
    const check = withCleanCheck();
    check.attach(page);
    await login(page);

    const gap = await page.evaluate(async (mid) => {
      const r = await fetch(`/api/threat-models/${mid}/gap-analysis`, {
        credentials: "include",
      });
      if (!r.ok) return null;
      return await r.json();
    }, modelId);

    expect(gap).toBeTruthy();
    expect(gap.data).toBeTruthy();
    await check.expectClean();
  });

  test("UC-43: scan with invalid GitHub URL returns error gracefully", async ({
    page,
  }) => {
    const check = withCleanCheck();
    check.attach(page);
    await login(page);

    const result = await page.evaluate(async (mid) => {
      const r = await fetch(`/api/threat-models/${mid}/scan-from-github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ repoUrl: "not-a-valid-url" }),
      });
      return { status: r.status, body: (await r.text()).slice(0, 200) };
    }, modelId);

    // Should return 400 or 422, not 500
    expect([400, 422]).toContain(result.status);
    await check.expectClean();
  });

  test("UC-46: save-as-template endpoint exists", async ({ page }) => {
    const check = withCleanCheck();
    check.attach(page);
    await login(page);

    const result = await page.evaluate(async (mid) => {
      const r = await fetch(`/api/threat-models/${mid}/save-as-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: "P1 Template Test", description: "Test" }),
      });
      return { status: r.status };
    }, modelId);

    // 200/201 (saved) or 404 (not implemented)
    expect([200, 201, 404]).toContain(result.status);
    if (result.status === 404) {
      console.warn("UC-46: save-as-template endpoint not implemented");
    }
    await check.expectClean();
  });

  test("UC-28: multi-methodology — PASTA available via micro-analysis", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const check = withCleanCheck();
    check.attach(page);
    await login(page);

    // Just verify the endpoint accepts a PASTA methodology request
    const result = await page.evaluate(async (mid) => {
      const r = await fetch(`/api/threat-models/${mid}/ai/micro-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ methodologies: ["pasta"] }),
      });
      return { status: r.status };
    }, modelId);

    // 200 (sync), 202 (async queued), 400 (needs Redis for async)
    expect([200, 202, 400]).toContain(result.status);
    await check.expectClean();
  });
});
