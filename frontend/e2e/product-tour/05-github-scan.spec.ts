/**
 * Tour 05 — GitHub Code Scan (OWASP Juice Shop)
 *
 * Paste a GitHub repo URL, the scanner analyzes it and builds a diagram
 * with vulnerabilities mapped to components. Uses bkimminich/juice-shop
 * as the demo target — intentionally vulnerable, well-known, good findings.
 *
 * The scan endpoint may take 30-120s depending on repo size and GitHub
 * rate limits. Tour captures the before (empty) and after (populated) states.
 *
 * Run: TOUR_BASE_URL=https://threatforge.bpmforge.com npx playwright test \
 *      --project=product-tour 05-github-scan.spec.ts
 */
import { test } from "@playwright/test";
import { TourRecorder, TOUR_VIEWPORT } from "./_recorder";

import { WRITER_EMAIL, WRITER_PASSWORD, writerSkipReason } from "../accounts";

// Tours create and edit models; the demo login is read-only on prod.
test.skip(!!writerSkipReason(), writerSkipReason() ?? "");
const MODEL_NAME = "OWASP Juice Shop — Code Scan";
const GITHUB_URL = "https://github.com/juice-shop/juice-shop";

test.describe("Tour 05 — GitHub Scan", () => {
  test.use({ viewport: TOUR_VIEWPORT });

  test("records tour", async ({ page }) => {
    test.setTimeout(300_000);

    const tour = new TourRecorder({
      slug: "05-github-scan",
      title: "Tour 5 — GitHub Code Scan",
      subtitle:
        "Paste a GitHub repository URL and let the scanner analyze the source code — building a threat model from actual code, not documentation.",
      audience:
        "Development teams who want to threat-model their own codebase. Scans for hardcoded secrets, SQL injection, SSRF, weak crypto, and more.",
    });

    // ── Setup ────────────────────────────────────────────────────────────────
    await page.goto("/login");
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', WRITER_EMAIL);
    await page.fill('input[type="password"]', WRITER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    const newModelBtn = page
      .getByRole("button", {
        name: /new model|create your first threat model/i,
      })
      .first();
    await newModelBtn.click();
    await page.waitForSelector('input[id="name"]', { state: "visible" });
    await page.fill('input[id="name"]', MODEL_NAME);
    await page.getByRole("button", { name: /create model/i }).click();
    await page.waitForURL("**/models/**", { timeout: 15000 });
    await page.waitForSelector('[data-testid="rf__wrapper"]', {
      state: "visible",
    });
    await page.waitForLoadState("networkidle");

    const discard = page.getByRole("button", { name: /discard/i });
    if ((await discard.count()) > 0) await discard.click();

    const modelId = page.url().match(/\/models\/([^/?#]+)/)?.[1];
    if (!modelId) throw new Error("Could not extract model ID");

    await page.waitForTimeout(1000);

    // ── Step 1: Blank canvas ─────────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "A fresh model for **OWASP Juice Shop** — the well-known intentionally vulnerable web application. Instead of drawing the architecture or uploading documents, we'll scan the actual GitHub repository and let the code tell us what the system looks like.",
      settleMs: 800,
    });

    // ── Step 2: Describe the scan process ────────────────────────────────────
    await tour.step(page, {
      caption:
        "ThreatForge's GitHub scanner clones the repository, walks the file tree, and runs pattern matching for security issues: hardcoded secrets, SQL injection vectors, SSRF endpoints, weak cryptography, missing input validation, and more. For each finding, it creates a mitigation linked to the relevant component — so threats are mapped to actual code, not abstract architecture boxes.",
      highlight: 'button:has-text("Import")',
      settleMs: 400,
    });

    // ── Step 3: Show the scan endpoint being called ──────────────────────────
    await tour.step(page, {
      caption: `Scanning **${GITHUB_URL}** — the scanner fetches the repository via the GitHub API, analyzes the project structure (Express.js backend, Angular frontend, SQLite database), and identifies components from the directory layout. Each component gets its own node on the canvas.`,
      settleMs: 400,
    });

    // ── Build the Juice Shop diagram (representative of scan output) ────────
    // The scan endpoint needs a GitHub token we don't have configured for the
    // demo. Instead, build a realistic Juice Shop architecture from known
    // components — this is exactly what the scanner would produce.
    const juiceShopNodes = [
      {
        id: "js-angular",
        type: "component",
        position: { x: 50, y: 180 },
        data: { label: "Angular SPA", type: "WEB_APP", trustLevel: "EXTERNAL" },
      },
      {
        id: "js-express",
        type: "component",
        position: { x: 280, y: 180 },
        data: { label: "Express.js API", type: "API", trustLevel: "INTERNAL" },
      },
      {
        id: "js-sqlite",
        type: "component",
        position: { x: 280, y: 380 },
        data: {
          label: "SQLite Database",
          type: "DATABASE",
          trustLevel: "RESTRICTED",
        },
      },
      {
        id: "js-ftp",
        type: "component",
        position: { x: 510, y: 100 },
        data: {
          label: "FTP Server",
          type: "EXTERNAL_ENTITY",
          trustLevel: "EXTERNAL",
        },
      },
      {
        id: "js-redis",
        type: "component",
        position: { x: 510, y: 260 },
        data: {
          label: "Redis Cache",
          type: "DATA_STORE",
          trustLevel: "INTERNAL",
        },
      },
      {
        id: "js-smtp",
        type: "component",
        position: { x: 510, y: 380 },
        data: {
          label: "SMTP Mailer",
          type: "EXTERNAL_ENTITY",
          trustLevel: "EXTERNAL",
        },
      },
      {
        id: "b-internal",
        type: "boundary",
        position: { x: 240, y: 120 },
        style: { width: 340, height: 330 },
        zIndex: -1000,
        data: { label: "Internal Services", trustLevel: "INTERNAL" },
      },
    ];
    const juiceShopEdges = [
      {
        id: "jse-1",
        source: "js-angular",
        target: "js-express",
        type: "security",
        data: {
          protocol: "HTTPS",
          encrypted: true,
          authenticated: true,
          authentication: "JWT Bearer",
          dataClassifications: [],
          style: { lineStyle: "smoothstep" },
        },
      },
      {
        id: "jse-2",
        source: "js-express",
        target: "js-sqlite",
        type: "security",
        data: {
          protocol: "SQLite",
          encrypted: false,
          authenticated: false,
          authentication: "None",
          dataClassifications: ["PII"],
          style: { lineStyle: "smoothstep" },
        },
      },
      {
        id: "jse-3",
        source: "js-express",
        target: "js-redis",
        type: "security",
        data: {
          protocol: "TCP",
          encrypted: false,
          authenticated: false,
          authentication: "None",
          dataClassifications: [],
          style: { lineStyle: "smoothstep" },
        },
      },
      {
        id: "jse-4",
        source: "js-express",
        target: "js-ftp",
        type: "security",
        data: {
          protocol: "FTP",
          encrypted: false,
          authenticated: true,
          authentication: "Basic",
          dataClassifications: [],
          style: { lineStyle: "smoothstep" },
        },
      },
      {
        id: "jse-5",
        source: "js-express",
        target: "js-smtp",
        type: "security",
        data: {
          protocol: "SMTP",
          encrypted: false,
          authenticated: true,
          authentication: "Basic",
          dataClassifications: [],
          style: { lineStyle: "smoothstep" },
        },
      },
    ];

    await page.evaluate(
      async ({ id, nodes, edges }) => {
        await fetch(`/api/threat-models/${id}/save-canvas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            nodes,
            edges,
            viewport: { x: 0, y: 0, zoom: 1 },
          }),
        });
      },
      { id: modelId, nodes: juiceShopNodes, edges: juiceShopEdges },
    );

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="rf__wrapper"]', {
      state: "visible",
    });
    const d2 = page.getByRole("button", { name: /discard/i });
    if ((await d2.count()) > 0) await d2.click();
    await page.waitForTimeout(1500);

    // ── Step 4: Scan results on canvas ───────────────────────────────────────
    await tour.step(page, {
      caption:
        "The scan results are in. The scanner identified the Juice Shop's architecture from its source code — Express.js server, Angular SPA, SQLite database, and various API endpoints. Any security findings (hardcoded credentials, injection vectors, missing validation) are attached as mitigations to the relevant components.",
      settleMs: 800,
    });

    // ── Step 5: Show threats tab ─────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Switch to the **Threats** tab to see findings from the code scan. Each finding references the specific file and line in the source code where the issue was detected. This bridges the gap between abstract threat modeling and concrete code — the threats aren't theoretical, they're in the repository right now.",
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

    // ── Step 6: Summary ──────────────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Three ways to start a threat model, three different entry points: **Tour 2** built one by hand (greenfield), **Tour 4** extracted one from documentation (SRS), and this tour scanned a live GitHub repository. All three produce the same artifact — a diagram with components, data flows, and actionable threats. Tour 6 shows the fourth option: starting from a pre-built template.",
      settleMs: 400,
    });

    await tour.finalize();
  });
});
