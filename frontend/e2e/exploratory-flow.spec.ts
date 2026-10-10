/**
 * Exploratory flow test: login → model → doc import → AI threat analysis
 * Reports what works, what fails, and any console errors.
 */
import { test, expect, type Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const SCREENSHOTS_DIR = path.join(process.cwd(), "test-results", "exploratory");

async function takeScreenshot(page: Page, name: string) {
  if (!fs.existsSync(SCREENSHOTS_DIR))
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`[screenshot] ${filePath}`);
}

/**
 * Login by posting directly to NextAuth credential callback with the CSRF
 * token captured from the same Playwright browser context (same cookie jar).
 */
async function loginDirect(
  page: Page,
  email: string,
  password: string,
): Promise<boolean> {
  // 1. Load login page to establish session cookies
  await page.goto("http://localhost:3000/login");
  await page.waitForLoadState("domcontentloaded");

  // 2. Get CSRF token using the same page context (shares cookies)
  const csrfToken = await page.evaluate(async () => {
    const r = await fetch("/api/auth/csrf", { credentials: "include" });
    const j = await r.json();
    return j.csrfToken as string;
  });

  if (!csrfToken) return false;

  // 3. Submit credentials
  const result = await page.evaluate(
    async ({ e, p, csrf }) => {
      const r = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        credentials: "include",
        redirect: "manual", // Don't follow redirect — just check where it goes
        body: new URLSearchParams({
          csrfToken: csrf,
          email: e,
          password: p,
          callbackUrl: "/dashboard",
        }).toString(),
      });
      return {
        status: r.status,
        url: r.url,
        redirected: r.redirected,
        type: r.type,
      };
    },
    { e: email, p: password, csrf: csrfToken },
  );

  console.log(
    `  login attempt ${email}: status=${result.status} url=${result.url} type=${result.type}`,
  );

  // 4. Navigate to dashboard — if auth cookie was set, it will work
  await page.goto("http://localhost:3000/dashboard");
  await page.waitForLoadState("domcontentloaded");
  const url = page.url();
  return url.includes("/dashboard") && !url.includes("/login");
}

test.describe("Exploratory: Full ThreatForge Flow", () => {
  test("login → model → doc import → AI threats", async ({ page }) => {
    test.setTimeout(240_000);

    const consoleErrors: string[] = [];
    const networkErrors: Array<{ status: number; url: string }> = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (
          text.includes("cloudflareinsights") ||
          text.includes("React DevTools") ||
          text.includes("favicon") ||
          text.includes("CSP") ||
          text.includes("ERR_CONNECTION_REFUSED") ||
          text.includes("net::ERR_") ||
          text.includes("beacon.min.js") ||
          text.includes("ResizeObserver") ||
          text.includes("hydration") ||
          text.includes("Warning:") ||
          text.includes("chunk") ||
          text.includes("Failed to load resource")
        )
          return;
        consoleErrors.push(text.slice(0, 300));
        console.log(`CONSOLE ERROR: ${text.slice(0, 300)}`);
      }
    });

    page.on("response", (res) => {
      const status = res.status();
      if (status >= 400) {
        const url = res.url().replace(/^https?:\/\/[^/]+/, "");
        if (!url.includes("favicon") && !url.includes("_next/static")) {
          networkErrors.push({ status, url });
        }
      }
    });

    const results: string[] = [];

    // ── Step 1: Login ──────────────────────────────────────────────────────────
    console.log("\nStep 1: Login...");
    await takeScreenshot(page, "01-login-page");

    const candidates = [
      // Credentials come from the environment ONLY. Real account/password pairs
      // used to be listed here; a literal password in a tracked file becomes a
      // working credential on an internet-facing login the moment the repo is
      // published. Set E2E_TEST_EMAIL / E2E_TEST_PASSWORD (see .env.example).
      {
        email: process.env.E2E_TEST_EMAIL || "test@example.com",
        password: process.env.E2E_TEST_PASSWORD || "TestPassword123!",
      },
    ];

    let loggedIn = false;
    let _loggedInEmail = "";

    for (const cred of candidates) {
      try {
        const ok = await loginDirect(page, cred.email, cred.password);
        if (ok) {
          loggedIn = true;
          _loggedInEmail = cred.email;
          results.push(
            `✓ Step 1: Login succeeded as ${cred.email} / ${cred.password}`,
          );
          console.log(`LOGIN SUCCESS: ${cred.email}`);
          break;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  login error: ${msg.slice(0, 100)}`);
      }
    }

    if (!loggedIn) {
      // Try the UI login as fallback
      console.log("  Direct login failed — trying UI login...");
      await page.goto("http://localhost:3000/login");
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      await page.fill('input[type="email"]', "e2etest@example.com");
      await page.fill('input[type="password"]', "Test1234!");
      await page.click('button[type="submit"]');
      await page.waitForTimeout(4000);

      const url = page.url();
      if (url.includes("/dashboard")) {
        loggedIn = true;
        _loggedInEmail = "e2etest@example.com (UI)";
        results.push(`✓ Step 1: Login succeeded via UI form`);
      } else {
        const pageText = await page.evaluate(
          () => document.body.innerText?.slice(0, 300) ?? "",
        );
        results.push(
          `✗ Step 1: All login attempts failed. Page says: ${pageText.slice(0, 200)}`,
        );
        // Capture auth-related console errors
        const authErrors = consoleErrors.filter(
          (e) =>
            e.includes("auth") || e.includes("fetch") || e.includes("sign"),
        );
        if (authErrors.length > 0) {
          results.push(
            `  Auth-related console errors: ${authErrors.join(" | ")}`,
          );
        }
        // Network errors during login
        const loginNetErrors = networkErrors.filter(
          (e) => e.url.includes("auth") || e.url.includes("session"),
        );
        if (loginNetErrors.length > 0) {
          results.push(
            `  Auth network errors: ${JSON.stringify(loginNetErrors)}`,
          );
        }
      }
    }

    await takeScreenshot(page, "02-after-login");

    if (!loggedIn) {
      // Report auth findings and stop
      const finalErrors = [...consoleErrors];
      const finalNetErrors = [...networkErrors];

      results.push(`\n--- Console Errors (${finalErrors.length}) ---`);
      finalErrors
        .slice(0, 10)
        .forEach((e) => results.push(`  [console.error] ${e}`));

      results.push(`\n--- Network Errors (${finalNetErrors.length}) ---`);
      finalNetErrors
        .slice(0, 10)
        .forEach((e) => results.push(`  HTTP ${e.status}: ${e.url}`));

      console.log("\n" + "=".repeat(60));
      console.log("EXPLORATORY TEST RESULTS");
      console.log("=".repeat(60));
      results.forEach((r) => console.log(r));
      console.log("=".repeat(60));
      expect(loggedIn, "Login must succeed to test the flow").toBe(true);
      return;
    }

    await page.waitForLoadState("networkidle");
    await takeScreenshot(page, "03-dashboard");

    // ── Step 2: Get or create a threat model ──────────────────────────────────
    console.log("\nStep 2: Finding or creating a threat model...");

    let modelId: string | null = null;
    let modelName = "";

    try {
      const modelsResp = await page.evaluate(async () => {
        const r = await fetch("/api/threat-models", { credentials: "include" });
        return { status: r.status, body: await r.json() };
      });
      console.log(`  GET /api/threat-models → ${modelsResp.status}`);

      if (modelsResp.status === 200) {
        const list = Array.isArray(modelsResp.body)
          ? modelsResp.body
          : (modelsResp.body?.data ?? []);
        if (list.length > 0) {
          modelId = list[0].id;
          modelName = list[0].name;
          results.push(
            `✓ Step 2a: Found existing model "${modelName}" (id=${modelId})`,
          );
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push(`~ Step 2a: GET models threw: ${msg}`);
    }

    if (!modelId) {
      try {
        const createResp = await page.evaluate(async () => {
          const r = await fetch("/api/threat-models", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ name: "Exploratory Test Model" }),
          });
          return { status: r.status, body: await r.json() };
        });
        console.log(`  POST /api/threat-models → ${createResp.status}`);
        const created = createResp.body?.data ?? createResp.body;
        if (createResp.status === 200 || createResp.status === 201) {
          modelId = created?.id;
          modelName = created?.name ?? "Exploratory Test Model";
          results.push(
            `✓ Step 2b: Created new model "${modelName}" (id=${modelId})`,
          );
        } else {
          results.push(
            `✗ Step 2b: Model creation failed — HTTP ${createResp.status}: ${JSON.stringify(createResp.body).slice(0, 200)}`,
          );
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push(`✗ Step 2b: Model creation threw: ${msg}`);
      }
    }

    if (!modelId) {
      results.push("✗ Cannot proceed without a model — stopping.");
      console.log("NO MODEL — stopping");
      console.log("=".repeat(60));
      results.forEach((r) => console.log(r));
      console.log("=".repeat(60));
      return;
    }

    // ── Step 2c: Navigate to canvas ───────────────────────────────────────────
    console.log(`\nStep 2c: Navigating to /models/${modelId}...`);

    // Clear autosave to prevent restore dialog
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (
          key.includes("canvas") ||
          key.includes("autosave") ||
          key.includes("backup")
        )
          localStorage.removeItem(key);
      }
    });

    await page.goto(`http://localhost:3000/models/${modelId}`);

    let canvasLoaded = false;
    try {
      await page.waitForSelector('[data-testid="rf__wrapper"]', {
        state: "visible",
        timeout: 20000,
      });
      canvasLoaded = true;
      results.push(`✓ Step 2c: Canvas loaded`);
    } catch {
      const pageTitle = await page.title();
      const pageText = await page.evaluate(
        () => document.body.innerText?.slice(0, 200) ?? "",
      );
      results.push(
        `✗ Step 2c: Canvas did not load. Title: "${pageTitle}". Page: ${pageText}`,
      );
    }

    // Dismiss restore dialog
    try {
      const discard = page.getByRole("button", { name: /discard/i });
      if ((await discard.count()) > 0 && (await discard.isVisible())) {
        await discard.click();
        results.push("  (dismissed restore dialog)");
      }
    } catch {}

    await page.waitForLoadState("networkidle");
    await takeScreenshot(page, "04-canvas");

    // ── Step 3: Document Import — API test ────────────────────────────────────
    console.log("\nStep 3a: Testing document import API...");

    const sampleText =
      "User Service communicates with Auth Service over HTTPS. Auth Service connects to PostgreSQL database. The API Gateway handles all external requests and routes to internal microservices.";

    const importApiResult = await page.evaluate(async (text: string) => {
      const r = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text, documentType: "SRS" }),
      });
      const body = await r.text().catch(() => "(unreadable)");
      return { status: r.status, body: body.slice(0, 800) };
    }, sampleText);

    console.log(
      `  POST /api/ai/extract → ${importApiResult.status}: ${importApiResult.body.slice(0, 100)}`,
    );

    if (importApiResult.status === 200 || importApiResult.status === 202) {
      results.push(
        `✓ Step 3a: Document import API accepted text — HTTP ${importApiResult.status}`,
      );
      try {
        const parsed = JSON.parse(importApiResult.body);
        const comps =
          parsed?.data?.components ?? parsed?.components ?? parsed?.data ?? [];
        const compList = Array.isArray(comps) ? comps : [];
        if (compList.length > 0) {
          results.push(
            `  Extracted ${compList.length} component(s): ${compList
              .slice(0, 5)
              .map(
                (c: { label?: string; name?: string }) =>
                  c.label ?? c.name ?? "?",
              )
              .join(", ")}`,
          );
        } else {
          results.push(`  Response: ${importApiResult.body.slice(0, 200)}`);
        }
      } catch {
        results.push(
          `  Response (non-JSON): ${importApiResult.body.slice(0, 200)}`,
        );
      }
    } else if (importApiResult.status === 400) {
      results.push(
        `~ Step 3a: Import API returned 400 (AI provider likely not configured): ${importApiResult.body.slice(0, 200)}`,
      );
    } else if (
      importApiResult.status === 401 ||
      importApiResult.status === 403
    ) {
      results.push(
        `✗ Step 3a: Import API returned ${importApiResult.status} — auth issue on this endpoint`,
      );
    } else {
      results.push(
        `✗ Step 3a: Import API returned HTTP ${importApiResult.status}: ${importApiResult.body.slice(0, 200)}`,
      );
    }

    // ── Step 3b: Document Import — UI ─────────────────────────────────────────
    if (canvasLoaded) {
      console.log("\nStep 3b: Looking for Import Document in toolbar UI...");

      // Scan all buttons and get their text/aria/testid attributes
      const allButtons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("button"))
          .map((b) => ({
            text: b.textContent?.trim().replace(/\s+/g, " ").slice(0, 50) ?? "",
            aria: b.getAttribute("aria-label") ?? "",
            testid: b.getAttribute("data-testid") ?? "",
            title: b.getAttribute("title") ?? "",
          }))
          .filter((b) => b.text || b.aria || b.testid || b.title);
      });

      const importRelated = allButtons.filter(
        (b) =>
          b.text.toLowerCase().includes("import") ||
          b.aria.toLowerCase().includes("import") ||
          b.testid.toLowerCase().includes("import") ||
          b.title.toLowerCase().includes("import"),
      );

      if (importRelated.length > 0) {
        results.push(
          `✓ Step 3b: Found ${importRelated.length} import-related button(s): ${JSON.stringify(importRelated)}`,
        );

        // Click the first import button
        const importBtn = page
          .locator(
            `button:has-text("Import"), [data-testid*="import"], [aria-label*="import" i]`,
          )
          .first();
        if ((await importBtn.count()) > 0) {
          await importBtn.click();
          await page.waitForTimeout(1500);
          await takeScreenshot(page, "05-import-dialog-open");

          // Check for dialog
          const dialogOpen = await page
            .locator('[role="dialog"]')
            .first()
            .isVisible()
            .catch(() => false);
          if (dialogOpen) {
            results.push("✓ Step 3c: Import dialog opened");

            // Look for textarea or text input inside dialog
            const textarea = page.locator('[role="dialog"] textarea').first();
            const textInputVisible =
              (await textarea.count()) > 0 &&
              (await textarea.isVisible().catch(() => false));
            if (textInputVisible) {
              await textarea.fill(sampleText);
              results.push(
                "✓ Step 3d: Pasted text into import dialog textarea",
              );

              const submitBtn = page
                .locator('[role="dialog"]')
                .getByRole("button", {
                  name: /import|extract|analyze|process/i,
                })
                .first();
              if ((await submitBtn.count()) > 0) {
                await submitBtn.click();
                results.push("✓ Step 3e: Clicked import/extract submit button");
                await page.waitForTimeout(5000);
                await takeScreenshot(page, "06-after-import-submit");

                // Check if any nodes appeared
                const nodeCount = await page.evaluate(
                  () =>
                    document.querySelectorAll(".react-flow__node, [data-id]")
                      .length,
                );
                if (nodeCount > 0) {
                  results.push(`✓ Step 4: Canvas now has ${nodeCount} node(s)`);
                } else {
                  results.push(
                    "~ Step 4: No nodes appeared on canvas after import",
                  );
                }
              } else {
                results.push("~ Step 3e: No submit button found inside dialog");
              }
            } else {
              // Check what is inside the dialog
              const dialogContent = await page
                .locator('[role="dialog"]')
                .first()
                .innerText()
                .catch(() => "");
              results.push(
                `~ Step 3d: No textarea in dialog. Dialog content: ${dialogContent.slice(0, 200)}`,
              );
            }

            // Try to close dialog
            const closeBtn = page
              .locator('[role="dialog"]')
              .getByRole("button", { name: /close|cancel|dismiss/i })
              .first();
            if ((await closeBtn.count()) > 0) await closeBtn.click();
            else await page.keyboard.press("Escape");
          } else {
            results.push(
              "~ Step 3c: Import button clicked but no dialog appeared",
            );
            await takeScreenshot(page, "05-no-dialog");
          }
        }
      } else {
        results.push(
          `~ Step 3b: No import button found in toolbar. Total buttons: ${allButtons.length}. Sample: ${JSON.stringify(allButtons.slice(0, 8))}`,
        );
      }
    } else {
      results.push("~ Step 3b: Skipped UI import test (canvas not loaded)");
    }

    await page.waitForLoadState("networkidle").catch(() => {});

    // ── Step 4: Canvas node count ──────────────────────────────────────────────
    console.log("\nStep 4: Canvas node count check...");
    const nodeCount = await page
      .evaluate(
        () =>
          document.querySelectorAll(
            '.react-flow__node, [data-testid^="rf__node"]',
          ).length,
      )
      .catch(() => 0);
    if (nodeCount > 0) {
      results.push(`✓ Step 4: Canvas has ${nodeCount} node(s) visible`);
    } else {
      results.push("~ Step 4: Canvas appears empty (no nodes)");
    }

    await takeScreenshot(page, "07-canvas-state");

    // ── Step 5: AI Threat Analysis ─────────────────────────────────────────────
    console.log("\nStep 5: AI threat analysis...");

    // API probe first — try multiple endpoints
    const aiEndpoints = [
      { url: `/api/threat-models/${modelId}/ai/suggest`, method: "POST" },
      { url: `/api/threat-models/${modelId}/analyze`, method: "POST" },
      { url: `/api/ai/suggest-threats`, method: "POST" },
      {
        url: `/api/threat-models/${modelId}/threats/suggest`,
        method: "POST",
      },
    ];

    for (const ep of aiEndpoints) {
      const epResult = await page.evaluate(
        async ({ url, method }) => {
          const r = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({}),
          });
          return {
            status: r.status,
            body: (await r.text().catch(() => "")).slice(0, 300),
          };
        },
        { url: ep.url, method: ep.method },
      );
      console.log(`  ${ep.method} ${ep.url} → ${epResult.status}`);
      if (epResult.status !== 404) {
        if (epResult.status === 200 || epResult.status === 202) {
          results.push(
            `✓ Step 5a: AI endpoint ${ep.url} responded HTTP ${epResult.status}`,
          );
        } else if (epResult.status === 400) {
          results.push(
            `~ Step 5a: ${ep.url} returned 400 (AI not configured?): ${epResult.body.slice(0, 150)}`,
          );
        } else {
          results.push(
            `~ Step 5a: ${ep.url} returned HTTP ${epResult.status}: ${epResult.body.slice(0, 150)}`,
          );
        }
        break;
      }
    }

    // UI button scan
    if (canvasLoaded) {
      const aiButtons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("button"))
          .map((b) => ({
            text: b.textContent?.trim().replace(/\s+/g, " ").slice(0, 50) ?? "",
            aria: b.getAttribute("aria-label") ?? "",
            testid: b.getAttribute("data-testid") ?? "",
          }))
          .filter(
            (b) =>
              b.text.toLowerCase().includes("threat") ||
              b.text.toLowerCase().includes("suggest") ||
              b.text.toLowerCase().includes("analyz") ||
              b.text.toLowerCase().includes("ai") ||
              b.aria.toLowerCase().includes("threat") ||
              b.aria.toLowerCase().includes("suggest"),
          );
      });

      if (aiButtons.length > 0) {
        results.push(
          `✓ Step 5b: Found ${aiButtons.length} AI-related button(s): ${JSON.stringify(aiButtons)}`,
        );
        // Click the first one
        const aiBtn = page
          .locator(
            'button:has-text("Suggest"), button:has-text("Threat"), button:has-text("AI"), [data-testid*="suggest"], [data-testid*="threat"]',
          )
          .first();
        if ((await aiBtn.count()) > 0) {
          await aiBtn.click();
          await page.waitForTimeout(3000);
          await takeScreenshot(page, "08-after-ai-trigger");
          results.push("  Clicked AI analysis button, waited 3s");
        }
      } else {
        results.push("~ Step 5b: No AI/Suggest/Threat buttons found on canvas");
      }
    } else {
      results.push("~ Step 5b: Skipped UI AI test (canvas not loaded)");
    }

    // ── Final summary ──────────────────────────────────────────────────────────
    await page.waitForLoadState("networkidle").catch(() => {});
    await takeScreenshot(page, "09-final");

    const filteredConsole = consoleErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("chunk"),
    );
    const filteredNetwork = networkErrors.filter(
      (e) =>
        e.status >= 500 ||
        e.status === 429 ||
        (e.status === 401 &&
          !e.url.includes("session") &&
          !e.url.includes("auth")),
    );

    if (filteredConsole.length > 0) {
      results.push(`\n--- Console Errors (${filteredConsole.length}) ---`);
      filteredConsole.slice(0, 10).forEach((e) => results.push(`  ${e}`));
    } else {
      results.push("\n--- Console Errors: none ---");
    }

    if (filteredNetwork.length > 0) {
      results.push(
        `\n--- Unexpected Network Errors (${filteredNetwork.length}) ---`,
      );
      filteredNetwork
        .slice(0, 10)
        .forEach((e) => results.push(`  HTTP ${e.status}: ${e.url}`));
    } else {
      results.push("\n--- Unexpected Network Errors: none ---");
    }

    results.push(`\nScreenshots saved to: ${SCREENSHOTS_DIR}`);

    console.log("\n" + "=".repeat(60));
    console.log("EXPLORATORY TEST RESULTS");
    console.log("=".repeat(60));
    results.forEach((r) => console.log(r));
    console.log("=".repeat(60));

    // Soft assertion — always write results regardless
    expect(results.length).toBeGreaterThan(0);
  });
});
