/**
 * Tour 01 — Getting Started
 *
 * Proof of concept for the product tour recorder. Covers the absolute minimum
 * a first-time user does: land on the login page, sign in, see the dashboard,
 * and create their first threat model.
 *
 * Run: TOUR_BASE_URL=https://threatforge.bpmforge.com npx playwright test \
 *      --project=product-tour 01-getting-started.spec.ts
 */
import { test } from "@playwright/test";
import { TourRecorder, TOUR_VIEWPORT } from "./_recorder";

import { WRITER_EMAIL, WRITER_PASSWORD, writerSkipReason } from "../accounts";

// Tours create and edit models; the demo login is read-only on prod.
test.skip(!!writerSkipReason(), writerSkipReason() ?? "");
const DEMO_MODEL_NAME = "Sample Threat Model";

test.describe("Tour 01 — Getting Started", () => {
  test.use({ viewport: TOUR_VIEWPORT });

  test("records tour", async ({ page }) => {
    test.setTimeout(180_000);

    const tour = new TourRecorder({
      slug: "01-getting-started",
      title: "Tour 1 — Getting Started",
      subtitle:
        "Log in to ThreatForge, land on the dashboard, and create your first threat model in under a minute.",
      audience:
        "First-time users. Shows the happy path from login to a blank canvas.",
    });

    // ── Step 1: The login page ───────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Open ThreatForge at **threatforge.bpmforge.com**. The login page shows the product's value proposition — STRIDE methodology, visual canvas, AI suggestions, and team collaboration — before you've even signed in.",
      action: async () => {
        await page.goto("/login", { waitUntil: "networkidle" });
      },
      waitFor: 'input[type="email"]',
      settleMs: 800,
    });

    // ── Step 2: Enter email ──────────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Enter your work email. ThreatForge supports standard email/password login and SSO via Auth.js, so it drops into existing identity systems without friction.",
      action: async () => {
        await page.fill('input[type="email"]', WRITER_EMAIL);
      },
      highlight: 'input[type="email"]',
      settleMs: 300,
    });

    // ── Step 3: Enter password ───────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Enter your password. Account lockout after 10 failed attempts protects against brute-force, and all authentication events are logged to the audit trail.",
      action: async () => {
        await page.fill('input[type="password"]', WRITER_PASSWORD);
      },
      highlight: 'input[type="password"]',
      settleMs: 300,
    });

    // ── Step 4: Click Sign In ────────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Click **Sign in** to authenticate. ThreatForge issues a signed JWT session cookie and redirects you to your dashboard.",
      highlight: 'button[type="submit"]',
      settleMs: 300,
    });

    // ── Step 5: Dashboard ────────────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "This is the main dashboard. Recent threat models are listed front and centre, with risk stats and readiness scores at a glance. The left sidebar gives quick access to analytics, compliance, and admin. The **New Model** button in the header is always one click away — no matter how many models you already have.",
      action: async () => {
        await page.click('button[type="submit"]');
        await page.waitForURL("**/dashboard**", { timeout: 20000 });
        await page.waitForLoadState("networkidle");
      },
      settleMs: 1500,
    });

    // ── Step 6: Click "New Model" ─────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Click **New Model** to start modeling a system. ThreatForge opens a dialog that lets you create a threat model directly — no mandatory project setup ceremony.",
      highlight: 'button:has-text("New Model")',
      settleMs: 400,
    });

    // ── Step 7: Create Model dialog ──────────────────────────────────────────
    await tour.step(page, {
      caption:
        "The **Create New Threat Model** dialog. You can associate the model with an existing project or start one standalone. The rest of this tour just verifies that a new model opens cleanly on a blank canvas — we'll start a real build in Tour 2 (greenfield), and demonstrate document-driven and code-driven builds in Tours 4 and 5.",
      action: async () => {
        await page
          .getByRole("button", { name: /new model/i })
          .first()
          .click();
        await page.waitForSelector('input[id="name"]', {
          state: "visible",
          timeout: 10000,
        });
      },
      settleMs: 800,
    });

    // ── Step 8: Enter model name ─────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Give the threat model a descriptive name. ThreatForge validates uniqueness within your organization and logs the creation to the audit trail.",
      action: async () => {
        await page.locator('input[id="name"]').fill(DEMO_MODEL_NAME);
      },
      highlight: 'input[id="name"]',
      settleMs: 500,
    });

    // ── Step 9: Click Create Model ───────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Click **Create Model** to provision the threat model. Behind the scenes ThreatForge creates the database record, initializes the canvas state, wires up real-time collaboration, and navigates you straight to the modeling surface.",
      highlight: 'button:has-text("Create Model")',
      settleMs: 300,
    });

    // ── Step 10: Canvas loaded ───────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "The blank canvas. On the left, a component palette with trust boundaries, DFD elements (Actors, Processes, Data Stores), and application types (Web App, Mobile App, API). The top toolbar has Save, Import, Export, History, undo/redo, and a **Readiness indicator** (top right) that starts at 0% and tracks seven completeness criteria as you build — components added, threats identified, critical threats mitigated, data flows, trust boundaries, and STRIDE category coverage. The right panel shows properties, threats, mitigations, compliance, and a **Docs tab** for any architecture documents linked to this model. The canvas uses Yjs CRDTs under the hood for real-time multi-user collaboration — multiple people can edit the same diagram simultaneously. Tour 2 builds a real system here.",
      action: async () => {
        await page.getByRole("button", { name: /create model/i }).click();
        await page.waitForURL("**/models/**", { timeout: 15000 });
        await page.waitForSelector('[data-testid="rf__wrapper"]', {
          state: "visible",
          timeout: 15000,
        });
        await page.waitForLoadState("networkidle");
      },
      settleMs: 2000,
    });

    await tour.finalize();
  });
});
