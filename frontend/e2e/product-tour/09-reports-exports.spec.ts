/**
 * Tour 09 — Reports & Exports
 * Show the export options, risk dashboard, and executive summary.
 */
import { test } from "@playwright/test";
import { TourRecorder, TOUR_VIEWPORT } from "./_recorder";

import { WRITER_EMAIL, WRITER_PASSWORD, writerSkipReason } from "../accounts";

// Tours create and edit models; the demo login is read-only on prod.
test.skip(!!writerSkipReason(), writerSkipReason() ?? "");

test.describe("Tour 09 — Reports & Exports", () => {
  test.use({ viewport: TOUR_VIEWPORT });

  test("records tour", async ({ page }) => {
    test.setTimeout(120_000);

    const tour = new TourRecorder({
      slug: "09-reports-exports",
      title: "Tour 9 — Reports & Exports",
      subtitle:
        "Export the threat model as PDF, JSON, YAML, or Risk Register CSV. View the executive risk dashboard.",
      audience:
        "CISOs, compliance officers, and anyone who needs to share findings outside the tool.",
    });

    await page.goto("/login");
    await page.fill('input[type="email"]', WRITER_EMAIL);
    await page.fill('input[type="password"]', WRITER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Find GreenSpot model
    const modelId = await page.evaluate(async () => {
      const r = await fetch("/api/threat-models", { credentials: "include" });
      const { data } = await r.json();
      return data.find((m: { name: string }) => m.name.includes("GreenSpot"))
        ?.id;
    });

    if (modelId) {
      await page.goto(`/models/${modelId}`);
      await page.waitForSelector('[data-testid="rf__wrapper"]', {
        state: "visible",
        timeout: 15000,
      });
      const discard = page.getByRole("button", { name: /discard/i });
      if ((await discard.count()) > 0) await discard.click();
      await page.waitForTimeout(1000);
    }

    // ── Step 1: Show the Export button ────────────────────────────────────────
    await tour.step(page, {
      caption:
        "The **Export** button in the toolbar provides multiple output formats. A threat model isn't useful if it stays in the tool — it needs to reach stakeholders who don't use ThreatForge: board members, auditors, partner security teams, and regulatory bodies.",
      highlight: 'button:has-text("Export")',
      settleMs: 400,
    });

    // ── Step 2: Show export dropdown ─────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Export formats include **PDF** (executive report with diagrams, threat tables, and compliance mapping), **JSON** (full model backup for version control or migration), **YAML** (human-readable, diff-friendly), and **Risk Register CSV** (GRC-compatible format for import into tools like ServiceNow, Archer, or spreadsheets). The canvas itself can also be exported as PNG or SVG.",
      action: async () => {
        await page
          .getByRole("button", { name: /^export$/i })
          .first()
          .click()
          .catch(() => {});
        await page.waitForTimeout(800);
      },
      settleMs: 500,
    });

    // ── Step 3: Risk Dashboard ───────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Navigate to the **Risk Dashboard** from the sidebar for the organization-wide view. This is the executive surface — total threat count, severity distribution, coverage trends, and the models with the highest unresolved risk. A CISO can scan this in 30 seconds and know where to focus.",
      action: async () => {
        await page.goto("/analytics/risk");
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);
      },
      settleMs: 800,
    });

    // ── Step 4: Portfolio view ────────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "The **Portfolio** analytics surface shows all threat models across all projects. Which products have the most critical threats? Which have the best mitigation coverage? Which are overdue for review? This turns threat modeling from a per-project activity into an organizational security program.",
      action: async () => {
        await page.goto("/analytics/portfolio");
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);
      },
      settleMs: 800,
    });

    // ── Step 5: Summary ──────────────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "That's the complete ThreatForge workflow: **build** the system diagram (manual, from docs, from code, or from a template), **analyze** with AI-powered STRIDE/PASTA/Kill Chain/MITRE, **mitigate** with evidence-linked controls, **comply** by mapping to regulatory frameworks, and **report** to stakeholders in their preferred format. Everything in one tool, connected end-to-end.",
      settleMs: 400,
    });

    await tour.finalize();
  });
});
