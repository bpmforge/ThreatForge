/**
 * UC-29: Model AI-settings save.
 *
 * T-01 / S6: the settings client sent PUT to
 * `/api/threat-models/:modelId/ai-settings`, but the server only registers
 * GET and PATCH there — the save 404'd. Fixed by switching the client to
 * PATCH (frontend/src/features/settings/services/api.ts). This spec exercises
 * the real save path (same PATCH verb + endpoint the app's own client now
 * uses, via the fixtures' apiPatch helper) against the local stack and
 * verifies the change round-trips through a GET.
 *
 * The PATCH body supplies a full `features`/`guardrails` shape rather than a
 * single-field partial: a fresh org's `aiSettings` column defaults to the
 * literal string "{}" (server/prisma/schema/02-organization.prisma), so the
 * route's `org.aiSettings ? JSON.parse(...) : DEFAULT_AI_SETTINGS` never
 * falls back to defaults and GET returns `{}` for an untouched org. That is
 * a separate, pre-existing defect outside T-01's write scope (server route
 * default-merging) — this test avoids depending on it rather than masking
 * it.
 */
import {
  test,
  expect,
  login,
  createModel,
  deleteModel,
  apiGet,
  apiPatch,
  withCleanCheck,
} from "./_fixtures";

test.describe("UC-29 — Model AI settings save", () => {
  let modelId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    const model = await createModel(page, "Test — AI Settings Save");
    modelId = model.id;
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    await deleteModel(page, modelId).catch(() => {});
    await page.close();
  });

  test("UC-29: saving AI settings returns 200 and round-trips", async ({
    page,
  }) => {
    const check = withCleanCheck();
    check.attach(page);
    await login(page);

    const payload = {
      enabled: true,
      provider: "claude" as const,
      features: {
        autoSuggestThreats: false,
        autoSuggestMitigations: false,
        enableChat: true,
        agentChainV2: false,
      },
      guardrails: {
        monthlyBudget: 0,
        anonymizeData: false,
        logInteractions: true,
      },
    };

    // apiPatch throws on a non-2xx response, so a successful resolve here
    // is itself the assertion that the save returned 200 (it 404'd before
    // the client was switched off PUT).
    const saved = await apiPatch<{
      enabled: boolean;
      provider: string;
      features: { enableChat: boolean };
    }>(page, `/api/threat-models/${modelId}/ai-settings`, payload);
    expect(saved.enabled).toBe(true);
    expect(saved.provider).toBe("claude");
    expect(saved.features.enableChat).toBe(true);

    const after = await apiGet<{
      enabled: boolean;
      provider: string;
      features: { enableChat: boolean };
    }>(page, `/api/threat-models/${modelId}/ai-settings`);
    expect(after.enabled).toBe(true);
    expect(after.provider).toBe("claude");
    expect(after.features.enableChat).toBe(true);

    await check.expectClean();
  });
});
