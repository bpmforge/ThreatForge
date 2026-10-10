/**
 * UC-03: Login failure — wrong password shows generic error, no info leakage.
 */
import { test, expect, withCleanCheck } from "./_fixtures";

test.describe("UC-03 — Login Failure", () => {
  // Tests deliberately submit wrong credentials — must start unauthenticated
  // so the /login page is actually shown rather than redirected to /dashboard.
  test.use({ storageState: { cookies: [], origins: [] } });
  test("wrong password shows generic error", async ({ page }) => {
    const check = withCleanCheck();
    check.attach(page);

    await page.goto("/login");
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', "demo-tour@threatforge.local");
    await page.fill('input[type="password"]', "wrongpassword123");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Should still be on login page
    expect(page.url()).toContain("/login");

    // Should show a generic error — NOT "wrong password" or "user not found"
    const errorVisible = await page
      .locator("text=/went wrong|try again|invalid/i")
      .isVisible();
    expect(errorVisible).toBe(true);

    // Session should NOT be set
    const session = await page.evaluate(async () => {
      const r = await fetch("/api/auth/session", { credentials: "include" });
      return r.ok ? await r.json() : null;
    });
    expect(session?.user).toBeFalsy();

    await check.expectClean({ allowedConsoleErrors: [/CredentialsSignin/] });
  });

  test("non-existent user shows same generic error (no enumeration)", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', "nonexistent-user@nowhere.dev");
    await page.fill('input[type="password"]', "anypassword");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    expect(page.url()).toContain("/login");
    const errorVisible = await page
      .locator("text=/went wrong|try again|invalid/i")
      .isVisible();
    expect(errorVisible).toBe(true);
  });
});
