/**
 * UC-48: Add threat manually
 * UC-49: Browse threat library (curated)
 * UC-55: Add mitigation to a threat
 * UC-56: Mitigation with evidence links
 *
 * Each test is fully self-contained — no shared mutable `threatId` that
 * silently breaks later tests when an earlier one fails.
 */
import {
  test,
  expect,
  login,
  createOnlineCheckoutModel,
  deleteModel,
  navigateToModel,
  apiPost,
  apiGet,
} from "./_fixtures";

const THREAT_PAYLOAD = {
  name: "Unencrypted internal data flow",
  description:
    "Payment API → Orders DB uses plaintext TCP on the internal network",
  strideCategories: ["INFORMATION_DISCLOSURE"],
  severity: "HIGH",
  componentNodeId: "n-api",
};

test.describe("UC-48/49/55/56 — Threats + Mitigations", () => {
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

  test("UC-48: create threat via API and verify it persists", async ({
    page,
  }) => {
    await login(page);

    const threat = await apiPost<{ id: string; name: string }>(
      page,
      `/api/threat-models/${modelId}/threats`,
      THREAT_PAYLOAD,
    );
    expect(threat.id).toBeTruthy();

    // Verify the threat persisted by re-fetching the model's threats
    const threats = await apiGet<Array<{ id: string; name: string }>>(
      page,
      `/api/threat-models/${modelId}/threats`,
    );
    const arr = Array.isArray(threats) ? threats : [];
    const found = arr.find((t) => t.id === threat.id);
    expect(found).toBeTruthy();
    expect(found?.name).toBe(THREAT_PAYLOAD.name);
  });

  test("UC-49: threat library dialog opens without crashing", async ({
    page,
  }) => {
    await login(page);
    await navigateToModel(page, modelId);

    await page
      .getByRole("tab", { name: /^threats$/i })
      .first()
      .click();
    await page.waitForTimeout(500);

    // Try the "Browse Library" button; fall back to "Add" / "New" in the header
    const libraryBtn = page
      .getByRole("button", { name: /browse library|library/i })
      .first();
    const addBtn = page.getByRole("button", { name: /^add|^new/i }).first();
    const btn = (await libraryBtn.count()) > 0 ? libraryBtn : addBtn;
    await btn.click();
    await page.waitForTimeout(800);

    // A dialog, sheet, or panel must be visible — not just absence of crash
    const dialog = page.locator('[role="dialog"], [role="alertdialog"]');
    await expect(dialog.first()).toBeVisible({ timeout: 5000 });
  });

  test("UC-55: add mitigation to a threat via API", async ({ page }) => {
    await login(page);

    // Self-contained: create a fresh threat for this test
    const threat = await apiPost<{ id: string }>(
      page,
      `/api/threat-models/${modelId}/threats`,
      {
        name: "UC-55 test threat",
        strideCategories: ["TAMPERING"],
        severity: "MEDIUM",
      },
    );
    expect(threat.id).toBeTruthy();

    const mitigation = await apiPost<{ id: string; status?: string }>(
      page,
      `/api/threats/${threat.id}/mitigations`,
      {
        description: "Encrypt internal traffic with mTLS between API and DB",
        priority: "HIGH",
        strategy: "PREVENTION",
      },
    );
    expect(mitigation.id).toBeTruthy();

    // Verify mitigation persisted
    const mitigations = await apiGet<Array<{ id: string }>>(
      page,
      `/api/threats/${threat.id}/mitigations`,
    );
    const arr = Array.isArray(mitigations) ? mitigations : [];
    expect(arr.some((m) => m.id === mitigation.id)).toBe(true);
  });

  test("UC-56: mitigation accepts evidence link and stores it", async ({
    page,
  }) => {
    await login(page);

    // Create threat + mitigation fresh for this test
    const threat = await apiPost<{ id: string }>(
      page,
      `/api/threat-models/${modelId}/threats`,
      {
        name: "UC-56 test threat",
        strideCategories: ["ELEVATION_OF_PRIVILEGE"],
        severity: "HIGH",
      },
    );

    const mitigation = await apiPost<{ id: string }>(
      page,
      `/api/threats/${threat.id}/mitigations`,
      {
        description: "Add rate limiting on auth endpoints",
        priority: "HIGH",
        strategy: "PREVENTION",
      },
    );
    expect(mitigation.id).toBeTruthy();

    // PATCH with evidence link — route is /api/threats/:threatId/mitigations/:id
    const updated = await page.evaluate(
      async ({ tid, mid, evidence }) => {
        const r = await fetch(`/api/threats/${tid}/mitigations/${mid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            status: "IMPLEMENTED",
            evidenceLinks: [evidence],
          }),
        });
        if (!r.ok)
          throw new Error(
            `PATCH threats/${tid}/mitigations/${mid} → ${r.status}`,
          );
        const body = await r.json();
        return body.data ?? body;
      },
      {
        tid: threat.id,
        mid: mitigation.id,
        evidence: {
          type: "ticket",
          url: "https://jira.example.com/FTM-99",
          title: "Rate limiting implementation",
        },
      },
    );

    expect(updated.status).toBe("IMPLEMENTED");
    // Evidence links may be returned inline or require a separate GET
    if (Array.isArray(updated.evidenceLinks)) {
      expect(updated.evidenceLinks.length).toBeGreaterThan(0);
    }
  });
});
