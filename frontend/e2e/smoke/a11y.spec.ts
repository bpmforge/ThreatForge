/**
 * Accessibility Smoke Test (P-05)
 *
 * One axe-core pass over the login page, dashboard, a model canvas, and the
 * reports page. Read-only: logs in and navigates, writes nothing. Fails the
 * test on any "serious" or "critical" impact violation; "minor"/"moderate"
 * violations are logged via test.info().annotations (and console) but do
 * not fail the run.
 *
 * Run: TOUR_BASE_URL=https://threatforge.bpmforge.com \
 *   npx playwright test --project=smoke-prod e2e/smoke/a11y.spec.ts
 *
 * First run (2026-09-22, against prod) found real serious/critical violations
 * on all four pages — see KNOWN_VIOLATIONS below and the P-05 PR body for the
 * full list (id, impact, page, selector). Those specific ids are marked
 * test.fixme() so the suite stays green without hiding regressions: any NEW
 * violation id (not in KNOWN_VIOLATIONS) still fails the test.
 *
 * F-04 (2026-09-23) fixed every id below and removed it from
 * KNOWN_VIOLATIONS — see the F-04 PR body for per-violation detail and the
 * local axe run that confirms it. KNOWN_VIOLATIONS is now empty; it stays
 * in place so a future regression falls straight into this mechanism.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { Result } from "axe-core";

const DEMO_EMAIL = "demo-tour@threatforge.local";
const DEMO_PASSWORD = "DemoTour2026!";

const FAILING_IMPACTS = new Set(["serious", "critical"]);

// Serious/critical violations pending a fix, keyed by page label, so the
// suite stays green while a fix ticket is filed. Add an id here only with a
// PR body explaining why it can't be fixed yet; remove it once the page is
// fixed — the test will then enforce it going forward. Empty as of F-04.
const KNOWN_VIOLATIONS: Record<string, string[]> = {};

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 20000 });
}

async function getFirstModelId(page: Page): Promise<string | undefined> {
  return page.evaluate(async () => {
    const r = await fetch("/api/threat-models", { credentials: "include" });
    const b = await r.json();
    return (b.data ?? b)[0]?.id as string | undefined;
  });
}

/**
 * Runs axe against the current page, logs every violation (id, impact, page,
 * selectors) via test.info().annotations + console. Serious/critical
 * violations whose id is already in KNOWN_VIOLATIONS[pageLabel] mark the
 * test test.fixme() (keeps the suite green); any other serious/critical
 * violation still fails the test.
 */
async function runAxe(page: Page, pageLabel: string) {
  // An empty model auto-opens the Guided Wizard; scanning mid fade-in reads
  // half-opaque colours as a contrast failure. Let animations settle first.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((a) => a.effect?.getTiming().iterations !== Infinity)
      .every((a) => a.playState !== "running"),
  );
  const results = await new AxeBuilder({ page }).analyze();
  const violations: Result[] = results.violations;

  for (const v of violations) {
    const selectors = v.nodes.map((n) => n.target.join(" ")).join(", ");
    const line = `[a11y] ${pageLabel} :: ${v.id} (${v.impact}) — ${v.help} — nodes: ${selectors}`;
    test.info().annotations.push({
      type: "a11y-violation",
      description: line,
    });
    console.log(line);
  }

  const failing = violations.filter(
    (v) => v.impact && FAILING_IMPACTS.has(v.impact),
  );
  const known = new Set(KNOWN_VIOLATIONS[pageLabel] ?? []);
  const unknownFailing = failing.filter((v) => !known.has(v.id));
  const knownFailing = failing.filter((v) => known.has(v.id));

  if (knownFailing.length > 0 && unknownFailing.length === 0) {
    test.fixme(
      true,
      `${pageLabel}: known serious/critical a11y violation(s) pending fix: ${knownFailing
        .map((v) => `${v.id} (${v.impact})`)
        .join(", ")} — see P-05 PR body for full detail`,
    );
    return;
  }

  expect(
    unknownFailing,
    `${pageLabel}: ${unknownFailing.length} unexpected serious/critical a11y violation(s): ${unknownFailing
      .map((v) => `${v.id} (${v.impact})`)
      .join(", ")}`,
  ).toHaveLength(0);
}

test.describe("accessibility (axe)", () => {
  test("login page has no serious/critical a11y violations", async ({
    page,
  }) => {
    await page.goto("/login");
    await runAxe(page, "login");
  });

  test("dashboard has no serious/critical a11y violations", async ({
    page,
  }) => {
    await login(page);
    await runAxe(page, "dashboard");
  });

  test("model canvas has no serious/critical a11y violations", async ({
    page,
  }) => {
    await login(page);
    const modelId = await getFirstModelId(page);
    expect(modelId, "No models on demo account").toBeTruthy();

    await page.goto(`/models/${modelId}`);
    await page.waitForSelector('[data-testid="rf__wrapper"]', {
      timeout: 30000,
    });
    await runAxe(page, "model canvas");
  });

  test("reports page has no serious/critical a11y violations", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/reports");
    await runAxe(page, "reports");
  });
});
