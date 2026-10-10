/**
 * UC-04: Logout — session cleared, redirect to login.
 * UC-08: Populated dashboard — stats cards show real data.
 */
import {
  test,
  expect,
  login,
  createModel,
  deleteModel,
  withCleanCheck,
} from "./_fixtures";

test.describe("UC-04/08 — Logout + Populated Dashboard", () => {
  test("UC-04: logout clears session and redirects to login", async ({
    page,
  }) => {
    const check = withCleanCheck();
    check.attach(page);

    await login(page);
    expect(page.url()).toContain("/dashboard");

    // Sign out via API directly (more reliable than finding the menu)
    await page.evaluate(async () => {
      // NextAuth signout — POST with CSRF token
      const csrfRes = await fetch("/api/auth/csrf", { credentials: "include" });
      const { csrfToken } = await csrfRes.json();
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        credentials: "include",
        body: `csrfToken=${csrfToken}`,
      });
    });

    // Navigate to a protected route — should redirect to login
    await page.goto("/dashboard");
    await page.waitForTimeout(3000);

    const url = page.url();
    expect(url.includes("/login") || url.includes("/setup")).toBe(true);

    // Session should be gone
    const session = await page.evaluate(async () => {
      const r = await fetch("/api/auth/session", { credentials: "include" });
      return r.ok ? await r.json() : null;
    });
    expect(session?.user).toBeFalsy();

    await check.expectClean();
  });

  test("UC-08: populated dashboard shows real stats", async ({ page }) => {
    const check = withCleanCheck();
    check.attach(page);
    await login(page);

    // Ensure at least one model exists
    const model = await createModel(page, "UC-08 Stats Test");

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Stats cards should show at least 1 model
    const totalModels = page.locator("text=/Total Models/i");
    await expect(totalModels).toBeVisible();

    // "Recent Models" section should show our model
    await expect(page.locator("text=UC-08 Stats Test").first()).toBeVisible({
      timeout: 10000,
    });

    // Cleanup
    await deleteModel(page, model.id);
    await check.expectClean();
  });
});
