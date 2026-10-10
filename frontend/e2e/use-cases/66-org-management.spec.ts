/**
 * UC-66: Organization management (US-9.1, US-9.2, US-9.3)
 *
 * US-9.1 — Create organization (POST /organizations)
 * US-9.2 — Manage members (GET /members, PATCH role)
 * US-9.3 — Custom roles (POST/GET /organizations/:orgId/roles)
 *
 * Strategy: create a throwaway org, exercise member + role endpoints,
 * then delete the org in afterAll. Uses a unique slug per run to avoid
 * conflicts if tests run concurrently.
 */
import {
  test,
  expect,
  login,
  apiPost,
  apiGet,
  apiPatch,
  apiDelete,
} from "./_fixtures";

const SLUG = `e2e-org-${Date.now()}`;

test.describe("UC-66 — Organization Management", () => {
  let orgId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    const org = await apiPost<{ id: string; slug: string }>(
      page,
      "/api/organizations",
      { name: "E2E Test Org", slug: SLUG },
    );
    orgId = org.id;
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!orgId) return;
    const page = await browser.newPage();
    await login(page);
    await apiDelete(page, `/api/organizations/${orgId}`).catch(() => {});
    await page.close();
  });

  test("US-9.1: created org is returned by GET /organizations", async ({
    page,
  }) => {
    await login(page);

    const orgs = await apiGet<Array<{ id: string; slug: string }>>(
      page,
      "/api/organizations",
    );
    const arr = Array.isArray(orgs) ? orgs : [];
    // API auto-generates slug from name — find by id, not our local SLUG constant
    const found = arr.find((o) => o.id === orgId);
    expect(found).toBeTruthy();
  });

  test("US-9.1: GET /organizations/:id returns org details", async ({
    page,
  }) => {
    await login(page);

    const org = await apiGet<{ id: string; name: string; slug: string }>(
      page,
      `/api/organizations/${orgId}`,
    );
    expect(org.id).toBe(orgId);
    expect(org.name).toBe("E2E Test Org");
  });

  test("US-9.2: GET /members returns current user as OWNER", async ({
    page,
  }) => {
    await login(page);

    const members = await apiGet<
      Array<{ id: string; role: string; user?: { email: string } }>
    >(page, `/api/organizations/${orgId}/members`);
    const arr = Array.isArray(members) ? members : [];

    expect(arr.length).toBeGreaterThanOrEqual(1);

    // Org creator should be OWNER
    const owner = arr.find((m) => m.role === "OWNER");
    expect(owner).toBeTruthy();
  });

  test("US-9.3: POST /roles creates a custom role", async ({ page }) => {
    await login(page);

    const role = await apiPost<{ id: string; name: string }>(
      page,
      `/api/organizations/${orgId}/roles`,
      {
        name: "E2E Reviewer",
        description: "Read-only reviewer role for E2E testing",
        permissions: ["models:read", "threats:read"],
      },
    );

    expect(role.id).toBeTruthy();
    expect(role.name).toBe("E2E Reviewer");
  });

  test("US-9.3: GET /roles lists created custom role", async ({ page }) => {
    await login(page);

    const roles = await apiGet<Array<{ id: string; name: string }>>(
      page,
      `/api/organizations/${orgId}/roles`,
    ).catch(() => [] as Array<{ id: string; name: string }>);

    const arr = Array.isArray(roles) ? roles : [];
    const found = arr.find((r) => r.name === "E2E Reviewer");
    expect(found).toBeTruthy();
  });

  test("US-9.1: PATCH /organizations/:id updates org name", async ({
    page,
  }) => {
    await login(page);

    const updated = await apiPatch<{ id: string; name: string }>(
      page,
      `/api/organizations/${orgId}`,
      { name: "E2E Test Org (Updated)" },
    );

    expect(updated.name).toBe("E2E Test Org (Updated)");
  });
});
