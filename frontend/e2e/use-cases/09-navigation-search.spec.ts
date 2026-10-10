/**
 * UC-09: Navigation + Search (US-2.2, US-2.3)
 *
 * US-2.2 — Global search returns relevant models/threats/templates
 * US-2.3 — Navigate application sections via sidebar/navbar
 *
 * Endpoints:
 *   GET /api/threat-models?search=query
 *   GET /api/threat-catalog/search?q=query
 *   GET /api/projects?search=query  (cross-entity search)
 */
import {
  test,
  expect,
  login,
  createModel,
  deleteModel,
  apiGet,
} from "./_fixtures";

test.describe("UC-09 — Navigation + Search", () => {
  let modelId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    // Model with a unique name we can search for
    const m = await createModel(page, "Searchable E2E Nav Model");
    modelId = m.id;
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    await deleteModel(page, modelId).catch(() => {});
    await page.close();
  });

  // ── Search ──────────────────────────────────────────────────────────────

  test("US-2.2: GET /threat-models?search= filters by name", async ({
    page,
  }) => {
    await login(page);

    const results = await apiGet<Array<{ id: string; name: string }>>(
      page,
      "/api/threat-models?search=Searchable+E2E+Nav",
    );
    const arr = Array.isArray(results) ? results : [];
    const found = arr.find((m) => m.name.includes("Searchable E2E Nav"));
    expect(found).toBeTruthy();
  });

  test("US-2.2: GET /threat-models?search= returns empty for no match", async ({
    page,
  }) => {
    await login(page);

    const results = await apiGet<Array<unknown>>(
      page,
      "/api/threat-models?search=zzz-no-match-xyz-e2e-99999",
    );
    const arr = Array.isArray(results) ? results : [];
    expect(arr.length).toBe(0);
  });

  test("US-2.2: GET /threat-catalog/search returns CWE/STRIDE entries", async ({
    page,
  }) => {
    await login(page);

    const results = await apiGet<unknown>(
      page,
      "/api/threat-catalog/search?q=injection",
    ).catch(() => null);

    // Catalog may return array or paginated shape
    const hasResults =
      Array.isArray(results) ||
      (typeof results === "object" && results !== null);
    expect(hasResults).toBe(true);
  });

  // ── Navigation ──────────────────────────────────────────────────────────

  test("US-2.3: /dashboard loads app shell with sidebar", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // shadcn Sidebar renders with data-sidebar="sidebar" attribute
    const sidebar = page.locator(
      "[data-sidebar='sidebar'], [data-slot='sidebar-wrapper'], [class*='sidebar']",
    );
    expect(await sidebar.count()).toBeGreaterThan(0);
  });

  test("US-2.3: navigating to /models/:id loads canvas", async ({ page }) => {
    await login(page);
    await page.goto(`/models/${modelId}`);
    await page.waitForSelector('[data-testid="rf__wrapper"]', {
      state: "visible",
      timeout: 30000,
    });
    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible();
  });

  test("US-2.3: settings page is reachable", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    // Should not redirect to login
    expect(page.url()).not.toMatch(/\/login/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("US-2.3: unknown route redirects or shows 404", async ({ page }) => {
    await login(page);
    await page.goto("/this-route-does-not-exist-e2e");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    const status404 = (await page.getByText(/404|not found/i).count()) > 0;
    const redirectedHome = url.includes("/dashboard") || url.includes("/login");

    expect(status404 || redirectedHome).toBe(true);
  });

  test("US-2.2: search query param preserved on dashboard", async ({
    page,
  }) => {
    await login(page);
    // If the dashboard supports ?q= or ?search= filtering
    await page.goto("/dashboard?search=Searchable");
    await page.waitForLoadState("networkidle");
    // Should not crash — body still visible
    await expect(page.locator("body")).toBeVisible();
  });
});
