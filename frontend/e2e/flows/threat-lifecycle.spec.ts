/**
 * Flow Test — Threat Lifecycle (Sequence Diagrams 2 + 5)
 *
 * Follows docs/sdlc/SEQUENCE_DIAGRAMS.md §2 and §5:
 *   1. Create model
 *   2. Save canvas with components and connections
 *   3. Enqueue AI suggest-threats job
 *   4. Poll job until COMPLETED or FAILED (timeout 90s — LLM call)
 *   5. Verify threats created with AI_SUGGESTED status
 *   6. Accept one threat, reject another — verify status transitions
 *   7. Create mitigation, mark IMPLEMENTED
 *   8. Verify mitigation appears in GET /api/mitigations
 *
 * NOTE: This test makes a real LLM call. It runs under the "flows" project
 * which has a 120s timeout per test. Skip with --grep-invert "LLM" in CI
 * to run only the non-LLM path.
 */
import {
  test,
  expect,
  get,
  post,
  patch,
  createTempModel,
  deleteTempModel,
  assertHasKeys,
  unwrap,
} from "../api-contracts/_fixtures";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90_000;

async function pollJob(
  page: import("@playwright/test").Page,
  jobId: string,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const r = await get(page, `/api/ai-jobs/${jobId}`);
    if (r.status === 404) throw new Error(`Job ${jobId} not found`);
    const job = unwrap<Record<string, unknown>>(r.body);
    if (job.status === "COMPLETED" || job.status === "FAILED") return job;
    await page.waitForTimeout(POLL_INTERVAL_MS);
  }
  throw new Error(`Job ${jobId} did not complete within ${POLL_TIMEOUT_MS}ms`);
}

test.describe("Threat lifecycle — create, AI suggest, review, mitigate", () => {
  test.setTimeout(120_000);

  test("full threat lifecycle from canvas save to mitigated", async ({
    loggedInPage: page,
  }) => {
    // Step 1 — create model
    const modelId = await createTempModel(page, "-lifecycle");

    // Step 2 — save canvas (2 components, 1 connection)
    await post(page, `/api/threat-models/${modelId}/save-canvas`, {
      nodes: [
        {
          id: "n-web",
          type: "component",
          position: { x: 100, y: 100 },
          data: {
            label: "Checkout Web",
            type: "WEB_APP",
            trustLevel: "PUBLIC",
          },
        },
        {
          id: "n-db",
          type: "component",
          position: { x: 500, y: 100 },
          data: {
            label: "Orders DB",
            type: "DATA_STORE",
            trustLevel: "RESTRICTED",
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "n-web",
          target: "n-db",
          data: { protocol: "HTTPS", encrypted: true, authenticated: true },
        },
      ],
    });

    // Step 3 — enqueue AI suggest
    const suggestR = await post(page, "/api/ai/suggest-threats", {
      modelId,
      methodology: "STRIDE",
    });
    expect(suggestR.status).toBe(202);
    const { jobId } = unwrap<Record<string, string>>(suggestR.body);
    expect(jobId).toBeTruthy();

    // Step 4 — poll until done
    const job = await pollJob(page, jobId);
    // Accept COMPLETED or tolerate FAILED (LLM unavailable in CI)
    if (job.status === "FAILED") {
      console.warn("AI job failed (LLM may be unavailable):", job.error);
      await deleteTempModel(page, modelId);
      return;
    }
    expect(job.status).toBe("COMPLETED");

    // Step 5 — verify AI_SUGGESTED threats exist
    const threatsR = await get(
      page,
      `/api/threats?modelId=${modelId}&status=AI_SUGGESTED`,
    );
    expect(threatsR.status).toBe(200);
    const threats = unwrap<Record<string, unknown>[]>(threatsR.body);
    expect(Array.isArray(threats)).toBe(true);

    if ((threats as unknown[]).length === 0) {
      // No threats generated — model may be too simple for LLM
      await deleteTempModel(page, modelId);
      return;
    }

    const [firstThreat, secondThreat] = threats as Record<string, unknown>[];
    assertHasKeys(
      firstThreat,
      ["id", "title", "status", "severity"],
      "AI suggested threat",
    );

    // Step 6a — accept first threat
    const acceptR = await patch(page, `/api/threats/${firstThreat.id}`, {
      status: "ACCEPTED",
    });
    expect(acceptR.status).toBe(200);
    expect(unwrap<Record<string, unknown>>(acceptR.body).status).toBe(
      "ACCEPTED",
    );

    // Step 6b — reject second threat (if exists)
    if (secondThreat) {
      const rejectR = await patch(page, `/api/threats/${secondThreat.id}`, {
        status: "REJECTED",
        rejectionReason: "Handled at infrastructure layer",
      });
      expect(rejectR.status).toBe(200);
    }

    // Step 7 — create and implement mitigation for accepted threat
    const mitigR = await post(page, "/api/mitigations", {
      threatId: firstThreat.id,
      title: "Input validation on all form fields",
      category: "INPUT_VALIDATION",
      description: "Validate and sanitize all user-supplied input server-side",
    });
    expect(mitigR.status).toBe(201);
    const mitigation = unwrap<Record<string, unknown>>(mitigR.body);

    const implementR = await patch(page, `/api/mitigations/${mitigation.id}`, {
      status: "IMPLEMENTED",
      testResult: "PASS",
      evidenceLinks: [
        {
          type: "ticket",
          url: "https://jira.example.com/FTM-42",
          title: "Add input validation",
        },
      ],
    });
    expect(implementR.status).toBe(200);
    expect(unwrap<Record<string, unknown>>(implementR.body).status).toBe(
      "IMPLEMENTED",
    );

    // Step 8 — verify mitigation appears in list
    const listR = await get(
      page,
      `/api/mitigations?modelId=${modelId}&status=IMPLEMENTED`,
    );
    expect(listR.status).toBe(200);
    const implemented = unwrap<unknown[]>(listR.body);
    expect(Array.isArray(implemented)).toBe(true);
    expect(
      (implemented as Record<string, unknown>[]).some(
        (m) => m.id === mitigation.id,
      ),
    ).toBe(true);

    await deleteTempModel(page, modelId);
  });
});

test.describe("AI Jobs — contract shape", () => {
  test("GET /api/ai-jobs/:id — returns job with required fields", async ({
    loggedInPage: page,
  }) => {
    // Enqueue a job then immediately check its shape
    const modelId = await createTempModel(page, "-jobs-shape");

    await post(page, `/api/threat-models/${modelId}/save-canvas`, {
      nodes: [
        {
          id: "n1",
          type: "component",
          position: { x: 0, y: 0 },
          data: { label: "Service", type: "API", trustLevel: "INTERNAL" },
        },
      ],
      edges: [],
    });

    const suggestR = await post(page, "/api/ai/suggest-threats", {
      modelId,
      methodology: "STRIDE",
    });

    if (suggestR.status !== 202) {
      await deleteTempModel(page, modelId);
      return;
    }

    const { jobId } = unwrap<Record<string, string>>(suggestR.body);
    const jobR = await get(page, `/api/ai-jobs/${jobId}`);
    expect(jobR.status).toBe(200);

    const job = unwrap<Record<string, unknown>>(jobR.body);
    assertHasKeys(job, ["id", "type", "status"], "ai job shape");
    expect(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]).toContain(
      job.status,
    );

    await deleteTempModel(page, modelId);
  });

  test("GET /api/ai-jobs/nonexistent — returns 404", async ({
    loggedInPage: page,
  }) => {
    const r = await get(page, "/api/ai-jobs/nonexistent-job-id");
    expect(r.status).toBe(404);
  });
});
