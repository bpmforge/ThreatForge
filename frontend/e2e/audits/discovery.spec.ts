/**
 * Discovery Audit — walks every page AND clicks every tab, dropdown, and
 * interactive panel to surface errors that only appear on user interaction.
 *
 * Phase 1: Visit all known routes (sidebar, admin, discovered links)
 * Phase 2: Click through tabs and interactive elements on key pages
 *
 * Produces docs/audits/discovery-YYYY-MM-DD.md
 *
 * Run:
 *   TOUR_BASE_URL=https://threatforge.bpmforge.com npx playwright test \
 *     --project=audits audits/discovery.spec.ts
 */
import { test, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const DEMO_EMAIL = "demo-tour@threatforge.local";
const DEMO_PASSWORD = "DemoTour2026!";

// Every known route in the sidebar + admin + settings sub-pages.
const PAGES: Array<{ path: string; label: string; needsModel?: boolean }> = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/projects", label: "Projects" },
  { path: "/templates", label: "Templates" },
  { path: "/analytics/risk", label: "Analytics — Risk" },
  { path: "/analytics/attack-paths", label: "Analytics — Attack Paths" },
  { path: "/analytics/attack-surface", label: "Analytics — Attack Surface" },
  { path: "/analytics/compliance", label: "Analytics — Compliance" },
  { path: "/analytics/portfolio", label: "Analytics — Portfolio" },
  { path: "/libraries/threats", label: "Libraries — Threats" },
  { path: "/libraries/components", label: "Libraries — Components" },
  { path: "/libraries/compliance", label: "Libraries — Compliance" },
  { path: "/reports", label: "Reports" },
  { path: "/notifications", label: "Notifications" },
  { path: "/reviews", label: "Reviews" },
  { path: "/profile", label: "Profile" },
  { path: "/organization", label: "Organization" },
  { path: "/admin", label: "Admin Console" },
  { path: "/models/%MODEL_ID%", label: "Model Canvas", needsModel: true },
];

// Pages with tabs/interactive elements to click through after loading.
// Each entry: page path pattern → array of tab label regexes to click.
const PAGE_TABS: Array<{
  match: string;
  label: string;
  tabs: Array<{ name: RegExp; label: string }>;
}> = [
  {
    match: "/models/",
    label: "Model Canvas",
    tabs: [
      { name: /props/i, label: "Props" },
      { name: /threats/i, label: "Threats" },
      { name: /^ai$/i, label: "AI" },
    ],
  },
  {
    match: "/profile",
    label: "Profile",
    tabs: [
      { name: /^profile$/i, label: "Profile" },
      { name: /^security$/i, label: "Security" },
      { name: /notifications/i, label: "Notifications" },
      { name: /appearance/i, label: "Appearance" },
      { name: /preferences/i, label: "Preferences" },
    ],
  },
  {
    match: "/organization",
    label: "Organization",
    tabs: [
      { name: /general/i, label: "General" },
      { name: /members/i, label: "Members" },
      { name: /roles/i, label: "Roles" },
      { name: /usage/i, label: "Usage" },
      { name: /ai providers/i, label: "AI Providers" },
      { name: /ai prompts/i, label: "AI Prompts" },
      { name: /webhooks/i, label: "Webhooks" },
      { name: /sso/i, label: "SSO" },
      { name: /activity/i, label: "Activity" },
      { name: /customization/i, label: "Customization" },
      { name: /integrations/i, label: "Integrations" },
      { name: /marketplace/i, label: "Marketplace" },
    ],
  },
  {
    match: "/admin/settings",
    label: "Admin Settings",
    tabs: [
      { name: /^general$/i, label: "General" },
      { name: /^email$/i, label: "Email" },
      { name: /^oauth/i, label: "OAuth Providers" },
      { name: /^security$/i, label: "Security" },
    ],
  },
  {
    match: "/libraries/threats",
    label: "Libraries — Threats",
    tabs: [
      { name: /by source/i, label: "By Source" },
      { name: /all threats/i, label: "All Threats" },
      { name: /indexes/i, label: "Indexes" },
    ],
  },
  {
    match: "/libraries/compliance",
    label: "Libraries — Compliance",
    tabs: [
      { name: /^custom/i, label: "Custom Frameworks" },
      { name: /^built.?in/i, label: "Built-in Frameworks" },
    ],
  },
];

// "More" dropdown sub-tabs on the model canvas right panel
const MODEL_MORE_TABS = [
  { name: /check/i, label: "Check" },
  { name: /suggest/i, label: "Suggest" },
  { name: /score/i, label: "Score" },
  { name: /comply/i, label: "Comply" },
  { name: /review/i, label: "Review" },
  { name: /chat/i, label: "Chat" },
  { name: /expert/i, label: "Expert" },
  { name: /refine/i, label: "Refine" },
  { name: /similar/i, label: "Similar" },
  { name: /docs/i, label: "Docs" },
  { name: /reqs/i, label: "Reqs" },
  { name: /gaps/i, label: "Gaps" },
  { name: /cover/i, label: "Cover" },
];

type Severity = "error" | "warning" | "info";

interface Finding {
  page: string;
  url: string;
  kind:
    | "console-error"
    | "network-4xx"
    | "network-5xx"
    | "request-failed"
    | "preload-warning"
    | "visible-error"
    | "slow-load"
    | "load-failed"
    | "tab-click-error"
    | "discovered-link";
  severity: Severity;
  detail: string;
}

const EXTENSION_NOISE = [
  "ERR_BLOCKED_BY_CLIENT",
  "net::ERR_FILE_NOT_FOUND",
  "Download the React DevTools",
  "chrome-extension://",
  "moz-extension://",
  "runtime.lastError",
  "message channel closed",
];

function isExtensionNoise(text: string): boolean {
  return EXTENSION_NOISE.some((p) => text.includes(p));
}

function repoRoot() {
  return path.resolve(__dirname, "../../..");
}

async function ensureDemoModel(page: Page): Promise<string | null> {
  const existing = await page.evaluate(async () => {
    const r = await fetch("/api/threat-models", { credentials: "include" });
    const { data } = await r.json();
    return data[0]?.id || null;
  });
  if (existing) return existing;

  const created = await page.evaluate(async () => {
    const r = await fetch("/api/threat-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: "Discovery Audit Model" }),
    });
    if (!r.ok) return null;
    const body = await r.json();
    return body.data?.id || body.id || null;
  });
  return created;
}

async function loginOnce(page: Page) {
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}

async function discoverLinks(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a[href]"));
    return links
      .map((a) => {
        try {
          const url = new URL(a.getAttribute("href") || "", location.origin);
          if (url.origin !== location.origin) return null;
          return url.pathname;
        } catch {
          return null;
        }
      })
      .filter((p): p is string => !!p && p !== "/" && !p.startsWith("/api/"));
  });
}

/** Click a tab by role and wait for content to settle. */
async function clickTab(
  page: Page,
  namePattern: RegExp,
  timeout = 3000,
): Promise<boolean> {
  const tab = page.getByRole("tab", { name: namePattern }).first();
  if ((await tab.count()) === 0) return false;
  // Scroll into view before checking visibility (tabs can be off-screen)
  await tab.scrollIntoViewIfNeeded({ timeout }).catch(() => {});
  const visible = await tab.isVisible().catch(() => false);
  if (!visible) return false;
  await tab.click({ timeout });
  await page.waitForTimeout(800);
  return true;
}

/** Click a dropdown menu item by text. */
async function clickMenuItem(
  page: Page,
  namePattern: RegExp,
  timeout = 3000,
): Promise<boolean> {
  const item = page
    .getByRole("menuitem", { name: namePattern })
    .or(page.getByRole("menuitemradio", { name: namePattern }))
    .first();
  if ((await item.count()) === 0) return false;
  const visible = await item.isVisible().catch(() => false);
  if (!visible) return false;
  await item.click({ timeout });
  await page.waitForTimeout(800);
  return true;
}

test.describe("Audit — Discovery", () => {
  test("walks all pages and clicks all tabs", async ({ page }) => {
    test.setTimeout(600_000);

    const findings: Finding[] = [];
    const visitedPaths = new Set<string>();
    let currentPage = "(setup)";
    const failedRequestUrls = new Set<string>();

    // ── Global listeners ──────────────────────────────────────────────────
    page.on("console", (msg) => {
      const text = msg.text().slice(0, 400);

      if (msg.type() === "error") {
        if (isExtensionNoise(text)) return;
        if (text.includes("favicon")) return;
        if (text.includes("ERR_CONNECTION_REFUSED")) return;
        if (
          text === "Failed to load resource: net::ERR_CONNECTION_REFUSED" ||
          text === "Failed to load resource: net::ERR_FAILED"
        )
          return;

        findings.push({
          page: currentPage,
          url: page.url(),
          kind: "console-error",
          severity: "error",
          detail: text,
        });
      }

      if (
        msg.type() === "warning" &&
        text.includes("preloaded") &&
        text.includes("not used")
      ) {
        findings.push({
          page: currentPage,
          url: page.url(),
          kind: "preload-warning",
          severity: "warning",
          detail: text,
        });
      }
    });

    page.on("requestfailed", (req) => {
      const url = req.url();
      if (url.includes("favicon")) return;
      if (isExtensionNoise(url)) return;
      if (
        url.includes("_rsc=") &&
        req.failure()?.errorText === "net::ERR_ABORTED"
      )
        return;

      const failure = req.failure()?.errorText || "unknown";
      const shortUrl = url.replace(/^https?:\/\/[^/]+/, "");
      const dedupKey = shortUrl.split("?")[0];
      if (failedRequestUrls.has(dedupKey)) return;
      failedRequestUrls.add(dedupKey);

      const isInfra =
        shortUrl.includes("beacon") || shortUrl.includes("analytics.js");
      const severity: Severity = isInfra ? "warning" : "error";

      findings.push({
        page: currentPage,
        url,
        kind: "request-failed",
        severity,
        detail: `${req.method()} ${shortUrl} — ${failure}`,
      });
    });

    page.on("response", (res) => {
      const status = res.status();
      if (status < 400) return;

      const url = res.url();
      if (url.includes("favicon")) return;

      const shortUrl = url.replace(/^https?:\/\/[^/]+/, "");
      const method = res.request().method();
      const kind = status >= 500 ? "network-5xx" : "network-4xx";
      const severity: Severity = status >= 500 ? "error" : "warning";

      findings.push({
        page: currentPage,
        url,
        kind,
        severity,
        detail: `${method} ${shortUrl} → ${status}`,
      });
    });

    // ── Login ─────────────────────────────────────────────────────────────
    currentPage = "Login";
    await loginOnce(page);
    const modelId = await ensureDemoModel(page);

    // ══════════════════════════════════════════════════════════════════════
    // PHASE 1: Visit every static page
    // ══════════════════════════════════════════════════════════════════════
    console.log("\n  ── Phase 1: Page navigation ──");

    const discoveredPaths: string[] = [];

    for (const p of PAGES) {
      const urlPath = p.path.replace("%MODEL_ID%", modelId || "missing");
      if (p.needsModel && !modelId) {
        findings.push({
          page: p.label,
          url: urlPath,
          kind: "load-failed",
          severity: "error",
          detail: "Skipped — no model available",
        });
        continue;
      }

      currentPage = p.label;
      visitedPaths.add(urlPath);
      console.log(`  → ${p.label}  ${urlPath}`);

      const t0 = Date.now();
      try {
        await page.goto(urlPath, { waitUntil: "networkidle", timeout: 20000 });
      } catch (err) {
        findings.push({
          page: p.label,
          url: urlPath,
          kind: "load-failed",
          severity: "error",
          detail: (err as Error).message.slice(0, 200),
        });
        continue;
      }
      const elapsed = Date.now() - t0;
      if (elapsed > 10000) {
        findings.push({
          page: p.label,
          url: urlPath,
          kind: "slow-load",
          severity: "warning",
          detail: `${(elapsed / 1000).toFixed(1)}s (> 10s)`,
        });
      }

      await page.waitForTimeout(500);

      // Visible error scan
      for (const sel of ['[role="alert"]', ".error-boundary"]) {
        const matches = await page
          .locator(sel)
          .all()
          .catch(() => []);
        for (const m of matches.slice(0, 3)) {
          const txt = (await m.textContent().catch(() => ""))?.trim() || "";
          if (!txt || txt.length < 5 || txt.length > 400) continue;
          const isVisible = await m.isVisible().catch(() => false);
          if (!isVisible) continue;
          findings.push({
            page: p.label,
            url: urlPath,
            kind: "visible-error",
            severity: "error",
            detail: txt.slice(0, 200),
          });
          break;
        }
      }

      // Discover links
      const links = await discoverLinks(page);
      for (const link of links) {
        if (!visitedPaths.has(link) && !discoveredPaths.includes(link)) {
          discoveredPaths.push(link);
        }
      }
    }

    // Visit discovered links
    const extraPaths = discoveredPaths.filter(
      (p) =>
        !visitedPaths.has(p) &&
        !p.match(/^\/models\//) &&
        !p.match(/^\/login|^\/register/) &&
        !p.includes("[") &&
        p.length < 100,
    );

    if (extraPaths.length > 0) {
      console.log(`\n  Discovered ${extraPaths.length} additional routes:`);
      for (const urlPath of extraPaths.slice(0, 20)) {
        currentPage = `Discovered: ${urlPath}`;
        visitedPaths.add(urlPath);
        console.log(`  → ${urlPath}`);

        findings.push({
          page: currentPage,
          url: urlPath,
          kind: "discovered-link",
          severity: "info",
          detail: `Found in-page link to ${urlPath}`,
        });

        try {
          await page.goto(urlPath, {
            waitUntil: "networkidle",
            timeout: 15000,
          });
        } catch (err) {
          findings.push({
            page: currentPage,
            url: urlPath,
            kind: "load-failed",
            severity: "error",
            detail: (err as Error).message.slice(0, 200),
          });
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // PHASE 2: Click through tabs and interactive elements
    // ══════════════════════════════════════════════════════════════════════
    console.log("\n  ── Phase 2: Tab & interaction exerciser ──");

    for (const pageConfig of PAGE_TABS) {
      // Navigate to the page
      let targetPath: string;
      if (pageConfig.match === "/models/") {
        if (!modelId) continue;
        targetPath = `/models/${modelId}`;
      } else {
        targetPath = pageConfig.match;
      }

      console.log(`  ▸ ${pageConfig.label} — ${pageConfig.tabs.length} tabs`);

      try {
        await page.goto(targetPath, {
          waitUntil: "networkidle",
          timeout: 20000,
        });
      } catch {
        console.log(`    ✗ Failed to load ${targetPath}`);
        continue;
      }
      await page.waitForTimeout(500);

      for (const tab of pageConfig.tabs) {
        currentPage = `${pageConfig.label} → ${tab.label}`;

        try {
          const clicked = await clickTab(page, tab.name);
          if (clicked) {
            console.log(`    ✓ ${tab.label}`);
          } else {
            console.log(`    – ${tab.label} (not found)`);
          }
        } catch (err) {
          console.log(`    ✗ ${tab.label} — error`);
          findings.push({
            page: currentPage,
            url: page.url(),
            kind: "tab-click-error",
            severity: "error",
            detail: `Tab "${tab.label}": ${(err as Error).message.slice(0, 200)}`,
          });
        }
      }

      // Model Canvas "More" dropdown — it's a button, not a tab
      if (pageConfig.match === "/models/") {
        const moreBtn = page.getByRole("button", { name: /more/i }).first();
        if (
          (await moreBtn.count()) > 0 &&
          (await moreBtn.isVisible().catch(() => false))
        ) {
          try {
            await moreBtn.click();
            await page.waitForTimeout(500);

            for (const sub of MODEL_MORE_TABS) {
              currentPage = `Model Canvas → More → ${sub.label}`;
              try {
                const clicked = await clickMenuItem(page, sub.name);
                if (clicked) {
                  console.log(`    ✓ More → ${sub.label}`);
                  // Re-open the More menu for the next item
                  await moreBtn.click().catch(() => {});
                  await page.waitForTimeout(300);
                } else {
                  console.log(`    – More → ${sub.label} (not found)`);
                }
              } catch (err) {
                console.log(`    ✗ More → ${sub.label} — error`);
                findings.push({
                  page: currentPage,
                  url: page.url(),
                  kind: "tab-click-error",
                  severity: "error",
                  detail: `Menu "${sub.label}": ${(err as Error).message.slice(0, 200)}`,
                });
                await moreBtn.click().catch(() => {});
                await page.waitForTimeout(300);
              }
            }

            await page.keyboard.press("Escape").catch(() => {});
          } catch {
            console.log(`    ✗ More dropdown — failed to open`);
          }
        } else {
          console.log(`    – More dropdown (not found)`);
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // PHASE 3: Click through project detail tabs (if a project exists)
    // ══════════════════════════════════════════════════════════════════════
    const projectPath = discoveredPaths.find((p) =>
      p.match(/^\/projects\/[a-z0-9]+$/),
    );
    if (projectPath) {
      console.log(`\n  ▸ Project Detail — ${projectPath}`);
      try {
        await page.goto(projectPath, {
          waitUntil: "networkidle",
          timeout: 15000,
        });
        await page.waitForTimeout(500);

        for (const tab of [
          { name: /models/i, label: "Models" },
          { name: /user stories/i, label: "User Stories" },
          { name: /settings/i, label: "Settings" },
        ]) {
          currentPage = `Project Detail → ${tab.label}`;
          try {
            const clicked = await clickTab(page, tab.name);
            console.log(
              `    ${clicked ? "✓" : "–"} ${tab.label}${clicked ? "" : " (not found)"}`,
            );
          } catch (err) {
            console.log(`    ✗ ${tab.label} — error`);
            findings.push({
              page: currentPage,
              url: page.url(),
              kind: "tab-click-error",
              severity: "error",
              detail: `Tab "${tab.label}": ${(err as Error).message.slice(0, 200)}`,
            });
          }
        }
      } catch {
        console.log(`    ✗ Failed to load project`);
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // Write the report
    // ══════════════════════════════════════════════════════════════════════
    const dateStr = new Date().toISOString().slice(0, 10);
    const auditsDir = path.join(repoRoot(), "docs", "audits");
    if (!fs.existsSync(auditsDir)) fs.mkdirSync(auditsDir, { recursive: true });
    const reportPath = path.join(auditsDir, `discovery-${dateStr}.md`);

    const errors = findings.filter((f) => f.severity === "error");
    const warnings = findings.filter((f) => f.severity === "warning");
    const infos = findings.filter((f) => f.severity === "info");

    const byPage: Record<string, Finding[]> = {};
    for (const f of findings) {
      if (!byPage[f.page]) byPage[f.page] = [];
      byPage[f.page].push(f);
    }

    const counts = findings.reduce(
      (acc, f) => {
        acc[f.kind] = (acc[f.kind] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const lines: string[] = [];
    lines.push(`# Discovery Audit — ${dateStr}`);
    lines.push("");
    lines.push(
      `_Ran against \`${process.env.TOUR_BASE_URL || "default baseURL"}\` as \`${DEMO_EMAIL}\`._`,
    );
    lines.push(
      `_Visited ${visitedPaths.size} pages. Clicked tabs/interactions on ${PAGE_TABS.length} pages._`,
    );
    lines.push("");

    lines.push("## Summary");
    lines.push("");
    lines.push(`| Severity | Count | Kinds |`);
    lines.push("|---|---|---|");
    lines.push(
      `| **Errors** | ${errors.length} | ${[...new Set(errors.map((e) => e.kind))].join(", ") || "—"} |`,
    );
    lines.push(
      `| **Warnings** | ${warnings.length} | ${[...new Set(warnings.map((w) => w.kind))].join(", ") || "—"} |`,
    );
    lines.push(
      `| **Info** | ${infos.length} | ${[...new Set(infos.map((i) => i.kind))].join(", ") || "—"} |`,
    );
    lines.push("");

    lines.push("### By kind");
    lines.push("");
    lines.push("| Kind | Count |");
    lines.push("|---|---|");
    for (const [kind, count] of Object.entries(counts).sort(
      (a, b) => b[1] - a[1],
    )) {
      lines.push(`| \`${kind}\` | ${count} |`);
    }
    lines.push("");

    if (errors.length > 0) {
      lines.push("## Errors (action required)");
      lines.push("");
      lines.push("| Page | Kind | Detail |");
      lines.push("|---|---|---|");
      for (const f of errors) {
        const detail = f.detail.replace(/\|/g, "\\|").replace(/\n/g, " ");
        lines.push(`| ${f.page} | \`${f.kind}\` | ${detail} |`);
      }
      lines.push("");
    }

    if (warnings.length > 0) {
      lines.push("## Warnings");
      lines.push("");
      lines.push("| Page | Kind | Detail |");
      lines.push("|---|---|---|");
      for (const f of warnings) {
        const detail = f.detail.replace(/\|/g, "\\|").replace(/\n/g, " ");
        lines.push(`| ${f.page} | \`${f.kind}\` | ${detail} |`);
      }
      lines.push("");
    }

    lines.push("## Full detail by page");
    lines.push("");
    for (const [pageLabel, pageFindings] of Object.entries(byPage)) {
      const pageErrors = pageFindings.filter((f) => f.severity === "error");
      const pageWarnings = pageFindings.filter((f) => f.severity === "warning");
      const icon =
        pageErrors.length > 0 ? "🔴" : pageWarnings.length > 0 ? "🟡" : "🟢";
      lines.push(`### ${icon} ${pageLabel}`);
      lines.push("");
      lines.push("| Kind | Severity | Detail |");
      lines.push("|---|---|---|");
      for (const f of pageFindings) {
        const detail = f.detail.replace(/\|/g, "\\|").replace(/\n/g, " ");
        lines.push(`| \`${f.kind}\` | ${f.severity} | ${detail} |`);
      }
      lines.push("");
    }

    if (findings.length === 0) {
      lines.push("_No findings. The app looks clean._");
    }

    fs.writeFileSync(reportPath, lines.join("\n"));
    console.log(
      `\n✓ Report written to ${path.relative(repoRoot(), reportPath)}`,
    );
    console.log(
      `  ${errors.length} errors, ${warnings.length} warnings, ${infos.length} info`,
    );
    for (const [kind, count] of Object.entries(counts)) {
      console.log(`  - ${kind}: ${count}`);
    }
  });
});
