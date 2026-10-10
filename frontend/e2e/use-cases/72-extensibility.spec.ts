/**
 * UC-72: Extensibility (US-20.3, US-20.4)
 *
 * The extensions registry tests (US-20.1) were removed with the feature, 2026-10-07.
 *
 * US-20.3 — Custom categories & libraries (org threat libraries)
 * US-20.4 — Component templates (org component template libraries)
 *
 * Endpoints:
 *   GET  /api/organizations/:orgId/threat-libraries   (custom categories)
 *   POST /api/organizations/:orgId/threat-libraries   (create library)
 *   GET  /api/organizations/:orgId/component-templates (component templates)
 *   POST /api/organizations/:orgId/component-templates (create library)
 */
import { test, expect, login, apiGet, apiPost, apiDelete } from "./_fixtures";

test.describe("UC-72 — Extensibility", () => {
  let orgId: string;
  let threatLibraryId: string;
  let componentLibraryId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    const orgs = await apiGet<Array<{ id: string }>>(
      page,
      "/api/organizations",
    );
    orgId = (Array.isArray(orgs) ? orgs : [])[0]?.id ?? "";
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    if (orgId) {
      if (threatLibraryId)
        await apiDelete(
          page,
          `/api/organizations/${orgId}/threat-libraries/${threatLibraryId}`,
        ).catch(() => {});
      if (componentLibraryId)
        await apiDelete(
          page,
          `/api/organizations/${orgId}/component-templates/${componentLibraryId}`,
        ).catch(() => {});
    }
    await page.close();
  });

  // ── Custom threat libraries ─────────────────────────────────────────────

  test("US-20.3: POST /threat-libraries creates a custom library", async ({
    page,
  }) => {
    test.skip(!orgId, "no org");
    await login(page);

    const lib = await apiPost<{ id: string; name: string }>(
      page,
      `/api/organizations/${orgId}/threat-libraries`,
      {
        name: "E2E Custom Threat Library",
        description: "Library for extensibility E2E test",
      },
    );

    expect(lib.id).toBeTruthy();
    expect(lib.name).toBe("E2E Custom Threat Library");
    threatLibraryId = lib.id;
  });

  test("US-20.3: GET /threat-libraries lists the custom library", async ({
    page,
  }) => {
    test.skip(!orgId || !threatLibraryId, "no org or library");
    await login(page);

    const libs = await apiGet<Array<{ id: string; name: string }>>(
      page,
      `/api/organizations/${orgId}/threat-libraries`,
    );
    const arr = Array.isArray(libs) ? libs : [];
    const found = arr.find((l) => l.id === threatLibraryId);
    expect(found).toBeTruthy();
  });

  test("US-20.3: GET /threat-libraries global list returns built-in libraries", async ({
    page,
  }) => {
    await login(page);

    const libs = await apiGet<unknown>(page, "/api/threat-libraries").catch(
      () => null,
    );
    const isValid =
      Array.isArray(libs) || (typeof libs === "object" && libs !== null);
    expect(isValid).toBe(true);
  });

  // ── Component templates ─────────────────────────────────────────────────

  test("US-20.4: POST /component-templates creates a template library", async ({
    page,
  }) => {
    test.skip(!orgId, "no org");
    await login(page);

    const lib = await apiPost<{ id: string; name: string }>(
      page,
      `/api/organizations/${orgId}/component-templates`,
      {
        name: "E2E Component Template Library",
        description: "Template library for extensibility E2E test",
      },
    );

    expect(lib.id).toBeTruthy();
    componentLibraryId = lib.id;
  });

  test("US-20.4: GET /component-templates lists the library", async ({
    page,
  }) => {
    test.skip(!orgId || !componentLibraryId, "no org or library");
    await login(page);

    const libs = await apiGet<Array<{ id: string }>>(
      page,
      `/api/organizations/${orgId}/component-templates`,
    );
    const arr = Array.isArray(libs) ? libs : [];
    const found = arr.find((l) => l.id === componentLibraryId);
    expect(found).toBeTruthy();
  });
});
