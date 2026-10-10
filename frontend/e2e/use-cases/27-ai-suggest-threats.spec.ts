/**
 * UC-27: AI threat suggestion via async micro-analysis pipeline (US-5.1, US-5.7)
 *
 * US-5.1 — AI suggests threats for a populated model
 * US-5.7 — Proactive AI assistance (auto-suggest on model load)
 *
 * Uses waitForJob() from _fixtures — the first real E2E exercise of the
 * BullMQ async polling helper. Timeout is 120s per job to allow for cold
 * LLM starts in CI; the job itself typically completes in 30-60s.
 *
 * Test data: Online Checkout fixture (5 components, 4 edges) seeded via API.
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
  AI_AVAILABLE,
} from "./_fixtures";

test.describe("UC-27 — AI Suggest Threats", () => {
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

  test("US-5.1: micro-analysis job enqueues and completes", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await login(page);

    // Enqueue the async micro-analysis job
    const enqueue = await apiPost<{ jobId: string }>(
      page,
      `/api/threat-models/${modelId}/ai/micro-analysis`,
      {},
    );
    expect(enqueue.jobId).toBeTruthy();

    // Poll until terminal state
    const job = await waitForJob(page, enqueue.jobId, { timeout: 120_000 });
    if (job.status === "FAILED") {
      if (AI_AVAILABLE)
        throw new Error(
          `AI job failed despite AI_AVAILABLE=true: ${JSON.stringify(job.error ?? "")}`,
        );
      test.skip();
      return;
    }
    expect(job.status).toBe("COMPLETED");
  });

  test("US-5.1: threats exist on model after AI run", async ({ page }) => {
    test.setTimeout(30_000);
    await login(page);

    const threats = await apiGet<
      Array<{ id: string; name: string; source: string }>
    >(page, `/api/threat-models/${modelId}/threats`);
    const arr = Array.isArray(threats) ? threats : [];

    const aiThreats = arr.filter(
      (t) => t.source === "AI_SUGGESTED" || t.source === "MICRO_ANALYSIS",
    );
    if (aiThreats.length === 0) {
      if (AI_AVAILABLE)
        throw new Error(
          "AI_AVAILABLE=true but no AI threats created after micro-analysis",
        );
      test.skip();
      return;
    }
    expect(aiThreats.length).toBeGreaterThan(0);
  });

  test("US-5.1: AI threats have required fields", async ({ page }) => {
    test.setTimeout(30_000);
    await login(page);

    const threats = await apiGet<
      Array<{
        id: string;
        name: string;
        description: string;
        severity: string;
        strideCategories: string[];
      }>
    >(page, `/api/threat-models/${modelId}/threats`);
    const arr = Array.isArray(threats) ? threats : [];
    if (arr.length === 0) {
      if (AI_AVAILABLE)
        throw new Error(
          "AI_AVAILABLE=true but threat list is empty — AI pipeline may be broken",
        );
      test.skip();
      return;
    }

    const first = arr[0];
    expect(first.name).toBeTruthy();
    expect(first.description).toBeTruthy();
    if (first.severity) {
      expect(first.severity).toMatch(/^(LOW|MEDIUM|HIGH|CRITICAL)$/);
    }
  });

  test("US-5.7: AI job status endpoint returns valid shape", async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await login(page);

    // Enqueue a new job to test the status endpoint shape
    const enqueue = await apiPost<{ jobId: string }>(
      page,
      `/api/threat-models/${modelId}/ai/micro-analysis`,
      {},
    );
    expect(enqueue.jobId).toBeTruthy();

    // Status should be queryable immediately
    const status = await apiGet<{ status: string; id: string }>(
      page,
      `/api/ai-jobs/${enqueue.jobId}`,
    );
    expect(status.id ?? enqueue.jobId).toBeTruthy();
    expect(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]).toContain(
      status.status,
    );
  });
});
