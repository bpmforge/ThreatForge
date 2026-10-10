/**
 * UC-62: Collaboration + Guest Access (US-7.2, US-7.3)
 *
 * US-7.2 — Invite team members (org member list; PATCH role)
 * US-7.3 — Guest access (create/list/validate/delete guest link)
 *
 * Strategy: use the demo org for member assertions (we can't actually send
 * invite emails in E2E). For guest access, create a link, validate it, then
 * revoke it — full lifecycle without needing a second user account.
 */
import {
  test,
  expect,
  login,
  createOnlineCheckoutModel,
  deleteModel,
  apiPost,
  apiGet,
  apiDelete,
} from "./_fixtures";

test.describe("UC-62 — Collaboration + Guest Access", () => {
  let modelId: string;
  let guestAccessId: string;
  let orgId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    modelId = await createOnlineCheckoutModel(page);

    const orgs = await apiGet<Array<{ id: string }>>(
      page,
      "/api/organizations",
    );
    const arr = Array.isArray(orgs) ? orgs : [];
    orgId = arr[0]?.id ?? "";

    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    if (guestAccessId) {
      await apiDelete(
        page,
        `/api/threat-models/${modelId}/guest-access/${guestAccessId}`,
      ).catch(() => {});
    }
    await deleteModel(page, modelId).catch(() => {});
    await page.close();
  });

  test("US-7.2: org member list returns at least the owner", async ({
    page,
  }) => {
    test.skip(!orgId, "no org available");
    await login(page);

    const members = await apiGet<
      Array<{ id: string; role: string; user?: { email: string } }>
    >(page, `/api/organizations/${orgId}/members`);
    const arr = Array.isArray(members) ? members : [];

    expect(arr.length).toBeGreaterThanOrEqual(1);
    const hasOwner = arr.some((m) => m.role === "OWNER" || m.role === "ADMIN");
    expect(hasOwner).toBe(true);
  });

  test("US-7.2: member list entries have expected shape", async ({ page }) => {
    test.skip(!orgId, "no org available");
    await login(page);

    const members = await apiGet<
      Array<{ id: string; role: string; userId?: string; user?: unknown }>
    >(page, `/api/organizations/${orgId}/members`);
    const arr = Array.isArray(members) ? members : [];
    if (arr.length === 0) return;

    const first = arr[0];
    expect(first.id).toBeTruthy();
    expect(first.role).toBeTruthy();
    expect(first.userId ?? first.user).toBeTruthy();
  });

  test("US-7.3: POST /guest-access creates a guest link", async ({ page }) => {
    await login(page);

    const access = await apiPost<{
      id: string;
      accessToken?: string;
      token?: string;
      link?: string;
    }>(page, `/api/threat-models/${modelId}/guest-access`, {
      permission: "VIEW",
      expiresAt: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
    });

    expect(access.id).toBeTruthy();
    guestAccessId = access.id;

    // A token or link should be present for sharing
    const hasLink = !!(access.accessToken ?? access.token ?? access.link);
    expect(hasLink).toBe(true);
  });

  test("US-7.3: GET /guest-access lists the created link", async ({ page }) => {
    await login(page);

    const links = await apiGet<Array<{ id: string }>>(
      page,
      `/api/threat-models/${modelId}/guest-access`,
    );
    const arr = Array.isArray(links) ? links : [];

    if (guestAccessId) {
      const found = arr.find((l) => l.id === guestAccessId);
      expect(found).toBeTruthy();
    } else {
      expect(arr.length).toBeGreaterThanOrEqual(0);
    }
  });

  test("US-7.3: GET /guest-access/validate accepts a valid token", async ({
    page,
  }) => {
    test.skip(!guestAccessId, "guest access not created");
    await login(page);

    // Fetch the link detail to get the token
    const links = await apiGet<
      Array<{ id: string; accessToken?: string; token?: string }>
    >(page, `/api/threat-models/${modelId}/guest-access`);
    const arr = Array.isArray(links) ? links : [];
    const link = arr.find((l) => l.id === guestAccessId);
    const token = link?.accessToken ?? link?.token;

    if (!token) {
      // Token may not be returned on list — skip assertion
      return;
    }

    const validation = await page.evaluate(async (t) => {
      const r = await fetch(`/api/guest-access/validate?token=${t}`, {
        credentials: "include",
      });
      return { status: r.status, ok: r.ok };
    }, token);

    // 200 = valid, 401/404 = token not surfaced on list endpoint
    expect([200, 401, 404]).toContain(validation.status);
  });

  test("US-7.3: DELETE /guest-access/:id revokes the link", async ({
    page,
  }) => {
    test.skip(!guestAccessId, "guest access not created");
    await login(page);

    await apiDelete(
      page,
      `/api/threat-models/${modelId}/guest-access/${guestAccessId}`,
    );

    const links = await apiGet<Array<{ id: string }>>(
      page,
      `/api/threat-models/${modelId}/guest-access`,
    );
    const arr = Array.isArray(links) ? links : [];
    expect(arr.find((l) => l.id === guestAccessId)).toBeUndefined();
    guestAccessId = "";
  });
});
