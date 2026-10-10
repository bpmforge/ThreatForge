/**
 * Tour 06 — Template Library (small tour)
 * Browse templates, show the 4th entry point for starting a threat model.
 */
import { test } from "@playwright/test";
import { TourRecorder, TOUR_VIEWPORT } from "./_recorder";

import { WRITER_EMAIL, WRITER_PASSWORD, writerSkipReason } from "../accounts";

// Tours create and edit models; the demo login is read-only on prod.
test.skip(!!writerSkipReason(), writerSkipReason() ?? "");

test.describe("Tour 06 — Templates", () => {
  test.use({ viewport: TOUR_VIEWPORT });

  test("records tour", async ({ page }) => {
    test.setTimeout(120_000);

    const tour = new TourRecorder({
      slug: "06-templates",
      title: "Tour 6 — Template Library",
      subtitle:
        "The fourth way to start a threat model: pick a pre-built template and customize it.",
      audience:
        "Teams who want a fast start with a common architecture pattern.",
    });

    await page.goto("/login");
    await page.fill('input[type="email"]', WRITER_EMAIL);
    await page.fill('input[type="password"]', WRITER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // ── Step 1: Navigate to Templates ────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Navigate to the **Templates** page from the sidebar. ThreatForge lets teams save any threat model as a reusable template — Web App, IoT Platform, API Service, and more. Each template captures the full canvas: components, connections, trust boundaries, and existing threats.",
      action: async () => {
        await page.goto("/templates");
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);
      },
      settleMs: 800,
    });

    // ── Step 2: Select a project to reveal template cards ────────────────────
    await tour.step(page, {
      caption:
        "Select your project to browse its saved templates. Templates are scoped per organization so each team's standard architectures stay in one place.",
      action: async () => {
        const combo = page.locator('button[role="combobox"]').first();
        await combo.click();
        await page.waitForSelector('[role="option"]', { timeout: 5000 });
        await page.locator('[role="option"]').first().click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1200);
      },
      settleMs: 600,
    });

    // ── Step 3: Template cards ───────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Template cards show the architecture type and description. Click **Use Template** to spin up a new threat model pre-loaded with that canvas — components, trust boundaries, and starter threats included. Four entry points for starting a model: **greenfield** (Tour 2), **document-driven** (Tour 4), **code-driven** (Tour 5), and **template** (this tour). Tour 7 shows what happens next: compliance gap analysis.",
      settleMs: 600,
    });

    await tour.finalize();
  });
});
