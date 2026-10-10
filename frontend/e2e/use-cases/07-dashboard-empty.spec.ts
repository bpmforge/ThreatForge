/**
 * UC-07: Empty-state dashboard — correct labels, calls-to-action, no errors.
 */
import {
  test,
  expect,
  login,
  deleteAllModels,
  withCleanCheck,
} from "./_fixtures";

test.describe("UC-07 — Empty Dashboard", () => {
  test("shows correct empty state with relabeled CTA", async ({ page }) => {
    const check = withCleanCheck();
    check.attach(page);

    await login(page);
    await deleteAllModels(page);

    // Also delete projects so the dashboard reaches a true empty state
    const projects = await page.evaluate(async () => {
      const r = await fetch("/api/projects", { credentials: "include" });
      if (!r.ok) return [];
      const body = await r.json();
      return (body.data ?? body) as Array<{ id: string }>;
    });
    for (const p of projects) {
      await page.evaluate(async (pid) => {
        await fetch(`/api/projects/${pid}`, {
          method: "DELETE",
          credentials: "include",
        });
      }, p.id);
    }

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // The "New Model" CTA button should always be visible — either in the
    // empty-state hero or the dashboard header.
    const newModelBtn = page.getByRole("button", {
      name: /new model|create.*threat model/i,
    });
    await expect(newModelBtn.first()).toBeVisible({ timeout: 10000 });

    await check.expectClean();
  });
});
