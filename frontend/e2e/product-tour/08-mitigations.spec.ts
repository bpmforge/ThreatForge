/**
 * Tour 08 — Mitigations & Evidence Chain
 * Add mitigations with evidence links, link to requirements.
 * Uses the GreenSpot model from Tour 04.
 */
import { test } from "@playwright/test";
import { TourRecorder, TOUR_VIEWPORT } from "./_recorder";

import { WRITER_EMAIL, WRITER_PASSWORD, writerSkipReason } from "../accounts";

// Tours create and edit models; the demo login is read-only on prod.
test.skip(!!writerSkipReason(), writerSkipReason() ?? "");

test.describe("Tour 08 — Mitigations", () => {
  test.use({ viewport: TOUR_VIEWPORT });

  test("records tour", async ({ page }) => {
    test.setTimeout(120_000);

    const tour = new TourRecorder({
      slug: "08-mitigations",
      title: "Tour 8 — Mitigations & Evidence Chain",
      subtitle:
        "Add mitigations to threats, attach evidence links, set test criteria, and link to compliance requirements — building the full traceability chain.",
      audience:
        "Security engineers documenting how threats are addressed, with evidence for auditors.",
    });

    await page.goto("/login");
    await page.fill('input[type="email"]', WRITER_EMAIL);
    await page.fill('input[type="password"]', WRITER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Find GreenSpot model and ensure it has a threat
    const modelId = await page.evaluate(async () => {
      const r = await fetch("/api/threat-models", { credentials: "include" });
      const { data } = await r.json();
      return data.find((m: { name: string }) => m.name.includes("GreenSpot"))
        ?.id;
    });

    if (modelId) {
      // Ensure there's a threat to add mitigations to
      await page.evaluate(async (id) => {
        const tr = await fetch(`/api/threat-models/${id}/threats`, {
          credentials: "include",
        });
        const threats = (await tr.json()).data || [];
        if (threats.length === 0) {
          await fetch(`/api/threat-models/${id}/threats`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              name: "Unencrypted sensor data in transit",
              description:
                "Sensor telemetry transmitted over LoRaWAN without end-to-end encryption",
              strideCategories: ["INFORMATION_DISCLOSURE"],
              severity: "HIGH",
            }),
          });
        }
      }, modelId);

      await page.goto(`/models/${modelId}`);
      await page.waitForSelector('[data-testid="rf__wrapper"]', {
        state: "visible",
        timeout: 15000,
      });
      const discard = page.getByRole("button", { name: /discard/i });
      if ((await discard.count()) > 0) await discard.click();
      await page.waitForTimeout(1000);
    }

    // ── Step 1: Show the model with threats ──────────────────────────────────
    await tour.step(page, {
      caption:
        "Back on the **GreenSpot Services** model. We have components from the document import (Tour 4) and compliance requirements from the framework import (Tour 7). Now we add the third layer: **mitigations** — the specific controls that address each threat.",
      settleMs: 800,
    });

    // ── Step 2: Show the Threats tab ─────────────────────────────────────────
    await tour.step(page, {
      caption:
        'The **Threats** tab lists every identified threat with its severity and STRIDE category. Each threat can have one or more mitigations — preventive, detective, and corrective controls. Each mitigation tracks a simple implementation state (**NOT_IMPLEMENTED → IMPLEMENTED**), a separate **verified** flag (has an auditor or test proven it works?), and an optional **obligation** — the compliance requirement that forces the control. Separating "built" from "verified" matches how real security teams operate: code ships before auditors sign off.',
      action: async () => {
        await page
          .getByRole("tab", { name: /^threats$/i })
          .first()
          .click()
          .catch(() => {});
        await page.waitForTimeout(800);
      },
      settleMs: 500,
    });

    // ── Step 3: Describe mitigation capabilities ─────────────────────────────
    await tour.step(page, {
      caption:
        'Each mitigation supports the full evidence chain: **control category** (IAM, ENCRYPTION, ACCESS_CONTROL, NETWORK, LOGGING, etc.), **test criteria** ("Confirm that all sensor data uses TLS 1.3"), **test result** (PASS/FAIL/PARTIAL), and **evidence links** — URLs to tickets, test reports, screenshots, or scan results that prove the control is in place.',
      settleMs: 400,
    });

    // ── Step 4: Requirement traceability ──────────────────────────────────────
    await tour.step(page, {
      caption:
        'Mitigations link directly to **compliance requirements** from the imported framework. When an auditor asks "how do you satisfy HIPAA §164.312(a)(1)?" — the answer is a specific mitigation, with evidence attached, on a specific threat, targeting a specific component. That\'s end-to-end traceability from regulation to code.',
      settleMs: 400,
    });

    // ── Step 5: Summary ──────────────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "The mitigation layer completes the threat modeling pipeline: **components** (what we're protecting), **threats** (what could go wrong), **mitigations** (how we prevent it), **evidence** (proof it's done), and **requirements** (why it matters for compliance). Tour 9 shows how to export all of this as reports.",
      settleMs: 400,
    });

    await tour.finalize();
  });
});
