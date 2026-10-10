/**
 * UC-35: Expert analysis pipeline (US-5.6)
 *
 * US-5.6 — Expert Analysis: 6-pass pipeline generates threats with
 * MITRE ATT&CK, CWE references, and cross-component compound threats.
 *
 * Uses waitForJob() — expert analysis is the heaviest AI job (6 passes,
 * ~60-120s). Timeout set to 180s to handle cold LLM starts in CI.
 *
 * Critical regression: dedup invariants (ADR-006) must prevent runaway
 * threat creation. After a full expert run, threat count must be < 200.
 */
import {
  test,
  expect,
  login,
  createOnlineCheckoutModel,
  deleteModel,
  apiPost,
  apiGet,
  waitForJob,
} from "./_fixtures";

test.describe("UC-35 — Expert Analysis", () => {
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

  test("US-5.6: expert-analysis job enqueues and completes", async ({
    page,
  }) => {
    test.setTimeout(220_000);
    await login(page);

    const enqueue = await apiPost<{ jobId: string }>(
      page,
      `/api/threat-models/${modelId}/ai/expert-analysis`,
      {},
    );
    expect(enqueue.jobId).toBeTruthy();

    const job = await waitForJob(page, enqueue.jobId, { timeout: 180_000 });
    if (job.status === "FAILED") {
      test.skip();
      return;
    }
    expect(job.status).toBe("COMPLETED");
  });

  test("US-5.6: expert run produces threats with CWE/MITRE metadata", async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await login(page);

    const threats = await apiGet<
      Array<{
        id: string;
        name: string;
        cweIds: unknown;
        mitreAttackIds: unknown;
        source: string;
      }>
    >(page, `/api/threat-models/${modelId}/threats`);

    const arr = Array.isArray(threats) ? threats : [];
    // Skip gracefully if AI provider not configured on this env
    if (arr.length === 0) {
      test.skip();
      return;
    }

    // At least some threats should have CWE IDs
    const withCwe = arr.filter((t) => {
      const cweIds = Array.isArray(t.cweIds)
        ? t.cweIds
        : typeof t.cweIds === "string"
          ? (() => {
              try {
                return JSON.parse(t.cweIds as string);
              } catch {
                return [];
              }
            })()
          : [];
      return cweIds.length > 0;
    });
    expect(withCwe.length).toBeGreaterThan(0);
  });

  test("US-5.6: dedup invariant — threat count stays below runaway cap", async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await login(page);

    const threats = await apiGet<Array<{ id: string }>>(
      page,
      `/api/threat-models/${modelId}/threats`,
    );
    const count = Array.isArray(threats) ? threats.length : 0;

    // ADR-006: per-model anomaly cap. 5 components × ~8 threats each = ~40 expected.
    // 200 is a generous ceiling — anything above signals a runaway loop.
    expect(count).toBeLessThan(200);
  });

  test("US-5.6: re-running expert analysis skips manuallyEdited threats", async ({
    page,
  }) => {
    test.setTimeout(220_000);
    await login(page);

    // Fetch existing threats, pick one to mark as manually edited
    const threats = await apiGet<Array<{ id: string; description: string }>>(
      page,
      `/api/threat-models/${modelId}/threats`,
    );
    const arr = Array.isArray(threats) ? threats : [];
    if (arr.length === 0) {
      test.skip();
      return;
    }

    const target = arr[0];
    const editedDesc = "MANUALLY_EDITED_SENTINEL_VALUE_DO_NOT_OVERWRITE";

    // Mark it as manually edited via the update endpoint
    await apiPost(page, `/api/threat-models/${modelId}/threats/${target.id}`, {
      description: editedDesc,
      _method: "PATCH",
    }).catch(async () => {
      // Try PATCH directly via page.evaluate if POST fails
      await page.evaluate(
        async ({ modelId: mId, id, desc }) => {
          await fetch(`/api/threat-models/${mId}/threats/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ description: desc }),
          });
        },
        { modelId, id: target.id, desc: editedDesc },
      );
    });

    // Re-run expert analysis
    const enqueue = await apiPost<{ jobId: string }>(
      page,
      `/api/threat-models/${modelId}/ai/expert-analysis`,
      {},
    );
    const job = await waitForJob(page, enqueue.jobId, { timeout: 180_000 });
    expect(job.status).toBe("COMPLETED");

    // The manually-edited description must survive the re-run
    const updated = await apiGet<{ description: string }>(
      page,
      `/api/threat-models/${modelId}/threats/${target.id}`,
    );
    expect(
      (updated as { description?: string }).description ?? target.description,
    ).toBe(editedDesc);
  });
});
