/**
 * Reseed the demo account: create any of EXPECTED_DEMO_MODELS that are missing.
 * Idempotent: existing models are left alone and nothing is deleted.
 *
 * Run: TOUR_BASE_URL=https://threatforge.bpmforge.com npx playwright test --project=reseed-demo
 *
 * Models are created by name with an empty canvas. That satisfies the smoke
 * gate; the guided-tour content (the GreenSpot SRS/SDS documents under
 * demodocs/) is restored separately through the UI import.
 *
 * It signs in as the demo account itself (not the writer the other suites use).
 * On the public host the demo is read-only, so this can only run while the
 * operator has taken demo-tour@threatforge.local out of DEMO_READONLY_USER_EMAILS
 * on the server. Read-only also means nothing can delete those models, so a
 * reseed should rarely be needed.
 */
import { test, expect } from "@playwright/test";
import { EXPECTED_DEMO_MODELS } from "../demo-models";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../accounts";
import {
  login,
  apiGet,
  createModel,
  type ModelInfo,
} from "../use-cases/_fixtures";

// Never reuse the writer session saved by global setup.
test.use({ storageState: { cookies: [], origins: [] } });

test("demo account holds every expected model", async ({ page }) => {
  await login(page, DEMO_EMAIL, DEMO_PASSWORD);
  const before = await apiGet<ModelInfo[]>(page, "/api/threat-models");
  const names = (Array.isArray(before) ? before : []).map((m) => m.name);

  const created: string[] = [];
  for (const expected of EXPECTED_DEMO_MODELS) {
    if (names.some((n) => n.includes(expected))) continue;
    const model = await createModel(page, expected);
    expect(model.id, `create "${expected}"`).toBeTruthy();
    created.push(expected);
  }

  const after = await apiGet<ModelInfo[]>(page, "/api/threat-models");
  const afterNames = (Array.isArray(after) ? after : []).map((m) => m.name);
  for (const expected of EXPECTED_DEMO_MODELS) {
    expect(
      afterNames.some((n) => n.includes(expected)),
      expected,
    ).toBe(true);
  }
  console.log(
    `reseed-demo: ${created.length} created (${created.join(", ") || "none"}), ${afterNames.length} models total`,
  );
});
