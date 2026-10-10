/**
 * P1 — Model lifecycle: UC-12 (rename), UC-13 (duplicate), UC-14 (delete),
 * UC-23 (undo/redo — skip, canvas-level), UC-06 (switch org — skip, single org demo)
 */
import {
  test,
  expect,
  login,
  createModel,
  deleteModel,
  apiGet,
  withCleanCheck,
} from "./_fixtures";

test.describe("P1 — Model Lifecycle", () => {
  test("UC-12: rename model via API", async ({ page }) => {
    const check = withCleanCheck();
    check.attach(page);
    await login(page);
    const m = await createModel(page, "UC-12 Original Name");

    const result = await page.evaluate(
      async ({ id }) => {
        const r = await fetch(`/api/threat-models/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: "UC-12 Renamed" }),
        });
        return { ok: r.ok, status: r.status };
      },
      { id: m.id },
    );

    expect(result.ok).toBe(true);

    const updated = await apiGet<{ name: string }>(
      page,
      `/api/threat-models/${m.id}`,
    );
    expect(updated.name).toBe("UC-12 Renamed");

    await deleteModel(page, m.id);
    await check.expectClean();
  });

  test("UC-13: duplicate model via API", async ({ page }) => {
    const check = withCleanCheck();
    check.attach(page);
    await login(page);
    const m = await createModel(page, "UC-13 Original");

    const result = await page.evaluate(
      async ({ id }) => {
        const r = await fetch(`/api/threat-models/${id}/duplicate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        });
        if (!r.ok)
          return {
            ok: false,
            status: r.status,
            error: (await r.text()).slice(0, 200),
          };
        return { ok: true, body: await r.json() };
      },
      { id: m.id },
    );

    if (!result.ok) {
      console.warn(
        `UC-13: duplicate returned ${(result as { status: number }).status}: ${(result as { error: string }).error}`,
      );
    }
    expect(result.ok).toBe(true);
    const body = (result as { ok: true; body: Record<string, unknown> }).body;
    const dupId = String(
      (body?.data as Record<string, unknown>)?.id || body?.id,
    );
    expect(dupId).toBeTruthy();

    await deleteModel(page, m.id);
    if (dupId) await deleteModel(page, dupId);
    await check.expectClean();
  });

  test("UC-14: delete model via API", async ({ page }) => {
    const check = withCleanCheck();
    check.attach(page);
    await login(page);
    const m = await createModel(page, "UC-14 Delete Me");

    const result = await page.evaluate(
      async ({ id }) => {
        const r = await fetch(`/api/threat-models/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        return { status: r.status };
      },
      { id: m.id },
    );

    expect([200, 204]).toContain(result.status);

    const after = await page.evaluate(
      async ({ id }) => {
        const r = await fetch(`/api/threat-models/${id}`, {
          credentials: "include",
        });
        return r.status;
      },
      { id: m.id },
    );
    expect(after).toBe(404);

    await check.expectClean();
  });
});
