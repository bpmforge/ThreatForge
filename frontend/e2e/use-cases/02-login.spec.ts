/**
 * UC-02: Login with valid credentials → lands on dashboard.
 */
import { test, expect, login, WRITER_EMAIL, withCleanCheck } from "./_fixtures";

test.describe("UC-02 — Login", () => {
  test("valid credentials reach dashboard with session", async ({ page }) => {
    const check = withCleanCheck();
    check.attach(page);

    await login(page);

    expect(page.url()).toContain("/dashboard");
    const session = await page.evaluate(async () => {
      const r = await fetch("/api/auth/session", { credentials: "include" });
      return r.ok ? await r.json() : null;
    });
    expect(session).toBeTruthy();
    expect(session?.user?.email).toBe(WRITER_EMAIL);

    await check.expectClean();
  });
});
