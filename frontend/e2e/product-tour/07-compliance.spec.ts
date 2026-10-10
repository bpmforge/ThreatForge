/**
 * Tour 07 — Requirements & Compliance Gap Analysis
 * Import a framework, show coverage dashboard, gap analysis.
 * Uses the GreenSpot model from Tour 04.
 */
import { test } from "@playwright/test";
import { TourRecorder, TOUR_VIEWPORT } from "./_recorder";

import { WRITER_EMAIL, WRITER_PASSWORD, writerSkipReason } from "../accounts";

// Tours create and edit models; the demo login is read-only on prod.
test.skip(!!writerSkipReason(), writerSkipReason() ?? "");

test.describe("Tour 07 — Compliance", () => {
  test.use({ viewport: TOUR_VIEWPORT });

  test("records tour", async ({ page }) => {
    test.setTimeout(180_000);

    const tour = new TourRecorder({
      slug: "07-compliance",
      title: "Tour 7 — Requirements & Compliance Gap Analysis",
      subtitle:
        "Import a compliance framework, map mitigations to requirements, and see which controls have gaps.",
      audience:
        "Compliance officers, security leads, and anyone preparing for an audit.",
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
      const m = data.find((m: { name: string }) =>
        m.name.includes("GreenSpot"),
      );
      return m?.id;
    });

    if (!modelId) {
      console.warn("Tour 07: GreenSpot model not found — creating one");
      // Fall through to dashboard screenshot
    }

    // ── Step 1: Navigate to model or show dashboard ──────────────────────────
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

    await tour.step(page, {
      caption:
        "Opening the **GreenSpot Services** model from Tour 4. The AI already extracted 8 components from the SRS. Now we'll layer compliance requirements on top — importing a framework and checking which threats have adequate mitigations.",
      settleMs: 800,
    });

    // ── Step 2: Import framework via API ─────────────────────────────────────
    if (modelId) {
      await page.evaluate(async (id) => {
        await fetch(`/api/threat-models/${id}/requirements/import/framework`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ frameworkId: "HIPAA", controlIds: ["*"] }),
        });
      }, modelId);
    }

    await tour.step(page, {
      caption:
        "ThreatForge includes **12 built-in compliance frameworks**: NIST 800-53, PCI-DSS 4.0, HIPAA, SOC 2, ISO 27001, NIST CSF, OWASP ASVS, CMMC, NIST 800-171, ISO 27701, CCPA, and FDA. We just imported HIPAA — its controls are now requirements that mitigations can be linked to.",
      settleMs: 600,
    });

    // ── Step 3: Show the gap analysis page ───────────────────────────────────
    await tour.step(page, {
      caption:
        "The **Gap Analysis** panel shows which threats are covered (have mitigations) and which are gaps. For each uncovered threat, it lists the severity and the compliance controls that require coverage. This is the artifact a compliance officer takes to an audit — concrete evidence of which risks are addressed and which remain open.",
      action: async () => {
        // Try to navigate to the gap analysis / requirements tab
        const moreTab = page.getByRole("tab", { name: /more/i }).first();
        if ((await moreTab.count()) > 0) {
          await moreTab.click();
          await page.waitForTimeout(500);
        }
      },
      settleMs: 600,
    });

    // ── Step 4: Show analytics ───────────────────────────────────────────────
    await tour.step(page, {
      caption:
        'Navigate to the **Compliance** analytics surface from the sidebar to see the organization-wide view: coverage percentage across all models, framework-by-framework breakdown, and trend over time. Click any framework card to open a **drill-down dialog** — covered vs. uncovered controls, the threats linked to each control, and the mitigations that satisfy them. This is the VP/CISO dashboard — "are we getting more secure or less?" at a glance, with one click down to individual control evidence.',
      action: async () => {
        await page.goto("/analytics/compliance");
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);
      },
      settleMs: 800,
    });

    // ── Step 5: Summary ──────────────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Requirements and compliance tie the threat model to real-world obligations. Each mitigation can be linked to the specific framework control it satisfies, with evidence (test reports, tickets, screenshots) attached directly. Tour 8 shows how to add mitigations with that evidence chain.",
      settleMs: 400,
    });

    await tour.finalize();
  });
});
