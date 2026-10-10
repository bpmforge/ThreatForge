/**
 * Manual exploratory test: Document import → AI extraction → threat suggestion
 * Credentials: demo@example.com / Demo1234!
 * Run against prod: TOUR_BASE_URL=https://threatforge.bpmforge.com npx playwright test e2e/manual-doc-import-flow.spec.ts --project=product-tour --headed
 * Run against local: npx playwright test e2e/manual-doc-import-flow.spec.ts --project=smoke --headed
 */
import { test } from "@playwright/test";

const EMAIL = "demo@example.com";
const PASSWORD = "Demo1234!";
const IMPORT_TEXT =
  "User Service communicates with Auth Service over HTTPS. Auth Service connects to PostgreSQL database on port 5432. Admin Panel is a web app that calls User Service API.";

test("doc-import-to-threats full flow", async ({ page }) => {
  test.setTimeout(240_000);

  const consoleErrors: string[] = [];
  const networkIssues: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (
        text.includes("favicon") ||
        text.includes("net::ERR_") ||
        text.includes("Failed to load resource") ||
        text.includes("Content-Security-Policy") ||
        text.includes("cloudflare") ||
        text.includes("beacon") ||
        text.includes("ResizeObserver") ||
        text.includes("Warning:")
      )
        return;
      consoleErrors.push(text.slice(0, 300));
      console.log("[CONSOLE ERROR]", text.slice(0, 300));
    }
  });

  page.on("response", (res) => {
    const s = res.status();
    const url = res.url().replace(/^https?:\/\/[^/]+/, "");
    if (
      (s >= 400 || s === 429) &&
      !url.includes("favicon") &&
      !url.includes("_next")
    ) {
      networkIssues.push(`${s} ${url}`);
      console.log(`[NETWORK ${s}]`, url);
    }
  });

  // ── Step 1: Login ─────────────────────────────────────────────────────────
  console.log("\n=== STEP 1: Login ===");
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);

  console.log("Submitting login form...");
  await page.click('button[type="submit"]');

  try {
    await page.waitForURL("**/dashboard**", { timeout: 20000 });
    console.log("Login SUCCESS — landed on dashboard:", page.url());
  } catch {
    // Check if login failed
    const errorEl = page.locator(
      '[role="alert"], .error, [data-testid="error"]',
    );
    const errorText =
      (await errorEl.count()) > 0
        ? await errorEl.first().textContent()
        : "unknown";
    console.log(
      "Login FAILED or redirected elsewhere. URL:",
      page.url(),
      "Error element:",
      errorText,
    );
    // Try to see what's on the page
    const title = await page.title();
    console.log("Page title:", title);
    // Take a screenshot description
    await page.screenshot({ path: "/tmp/login-result.png" });
    console.log("Screenshot saved to /tmp/login-result.png");

    // Attempt to continue if we're not on login page
    if (!page.url().includes("/login")) {
      console.log("Not on login page, continuing...");
    } else {
      throw new Error(
        `Login failed. Current URL: ${page.url()}, Error: ${errorText}`,
      );
    }
  }

  // ── Step 2: Find an existing model or navigate to dashboard ───────────────
  console.log("\n=== STEP 2: Find existing model ===");
  await page.waitForLoadState("networkidle");

  // Check for existing models via API
  const modelsResult = await page.evaluate(async () => {
    const r = await fetch("/api/threat-models", {
      credentials: "include",
    });
    const text = await r.text();
    console.log("Models API status:", r.status);
    if (!r.ok) return { ok: false, status: r.status, body: text.slice(0, 500) };
    try {
      const json = JSON.parse(text);
      const arr = json.data ?? json;
      return {
        ok: true,
        count: Array.isArray(arr) ? arr.length : 0,
        models: Array.isArray(arr) ? arr.slice(0, 5) : [],
      };
    } catch {
      return { ok: false, status: r.status, body: text.slice(0, 200) };
    }
  });

  console.log("Models API result:", JSON.stringify(modelsResult, null, 2));

  let modelId: string | null = null;

  if (modelsResult.ok && (modelsResult as { count: number }).count > 0) {
    const firstModel = (
      modelsResult as { models: { id: string; name: string }[] }
    ).models[0];
    modelId = firstModel.id;
    console.log(`Using existing model: "${firstModel.name}" (${modelId})`);
  } else {
    // Create a new model
    console.log("No existing models — creating one via API...");
    const createResult = await page.evaluate(async () => {
      const r = await fetch("/api/threat-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: "Doc Import Test — User/Auth/DB" }),
      });
      const text = await r.text();
      if (!r.ok)
        return { ok: false, status: r.status, body: text.slice(0, 500) };
      try {
        const json = JSON.parse(text);
        const model = json.data ?? json;
        return { ok: true, id: model.id, name: model.name };
      } catch {
        return { ok: false, status: r.status, body: text.slice(0, 200) };
      }
    });

    console.log("Create model result:", JSON.stringify(createResult, null, 2));
    if (createResult.ok && (createResult as { id: string }).id) {
      modelId = (createResult as { id: string }).id;
      console.log(`Created model ID: ${modelId}`);
    } else {
      // Fall back to UI creation
      console.log("API creation failed, trying UI...");
      const createBtn = page
        .getByRole("button", { name: /new model|create/i })
        .first();
      if ((await createBtn.count()) > 0) {
        await createBtn.click();
        await page.waitForSelector('input[id="name"], input[name="name"]', {
          timeout: 10000,
        });
        await page.fill(
          'input[id="name"], input[name="name"]',
          "Doc Import Test",
        );
        await page.getByRole("button", { name: /create model/i }).click();
        await page.waitForURL("**/models/**", { timeout: 15000 });
        const urlMatch = page.url().match(/\/models\/([^/?#]+)/);
        modelId = urlMatch?.[1] ?? null;
        console.log(`UI-created model ID: ${modelId}`);
      }
    }
  }

  if (!modelId) {
    throw new Error("Could not find or create a threat model");
  }

  // ── Step 3: Navigate to canvas ────────────────────────────────────────────
  console.log("\n=== STEP 3: Navigate to canvas ===");

  // Clear autosave state that might trigger restore dialog
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (
        key.includes("canvas") ||
        key.includes("autosave") ||
        key.includes("backup")
      ) {
        localStorage.removeItem(key);
      }
    }
  });

  await page.goto(`/models/${modelId}`);
  try {
    await page.waitForSelector('[data-testid="rf__wrapper"]', {
      timeout: 20000,
      state: "visible",
    });
    console.log("Canvas loaded successfully");
  } catch {
    console.log("Canvas wrapper not found. Current URL:", page.url());
    const bodyText = await page.locator("body").textContent();
    console.log("Page body (first 500 chars):", bodyText?.slice(0, 500));
    await page.screenshot({ path: "/tmp/canvas-load.png" });
  }
  await page.waitForLoadState("networkidle");

  // Dismiss restore dialog if present
  const discardBtn = page.getByRole("button", { name: /discard/i });
  if ((await discardBtn.count()) > 0) {
    console.log("Dismissing restore dialog...");
    await discardBtn.click();
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: "/tmp/step3-canvas.png" });
  console.log("Canvas screenshot: /tmp/step3-canvas.png");

  // ── Step 4: Find the Import button ────────────────────────────────────────
  console.log("\n=== STEP 4: Find import button ===");

  // Look for the Import button in the toolbar
  const importSelectors = [
    'button:has-text("Import")',
    '[aria-label*="import" i]',
    '[data-testid*="import" i]',
    'button[title*="import" i]',
  ];

  let importBtn = null;
  for (const sel of importSelectors) {
    const el = page.locator(sel).first();
    if ((await el.count()) > 0) {
      importBtn = el;
      console.log(`Found import button with selector: ${sel}`);
      break;
    }
  }

  if (!importBtn) {
    // List all buttons to diagnose
    const buttons = await page.locator("button").allTextContents();
    console.log("All buttons on page:", buttons.slice(0, 30));
    await page.screenshot({ path: "/tmp/step4-no-import.png" });
    console.log("No import button found. Screenshot: /tmp/step4-no-import.png");

    // Try the API path instead
    console.log("Falling back to API-based import...");
  } else {
    await importBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: "/tmp/step4-import-menu.png" });
    console.log("Import menu opened: /tmp/step4-import-menu.png");

    // ── Step 5: Select Document option ─────────────────────────────────────
    console.log("\n=== STEP 5: Select Document / IaC ===");
    const docOption = page
      .getByText(/Document.*IaC|Document.*PDF|Import.*Document/i)
      .first();
    if ((await docOption.count()) > 0) {
      await docOption.click();
      await page.waitForTimeout(600);
      console.log("Document option clicked");
    } else {
      // Try any menu item that mentions document
      const menuItems = await page
        .locator('[role="menuitem"], [role="option"]')
        .allTextContents();
      console.log("Menu items visible:", menuItems);
      await page.screenshot({ path: "/tmp/step5-menu.png" });
    }

    await page.screenshot({ path: "/tmp/step5-dialog.png" });
    console.log("Dialog state: /tmp/step5-dialog.png");

    // ── Step 6: Paste text into dialog ────────────────────────────────────
    console.log("\n=== STEP 6: Paste text ===");

    // Look for a Paste tab
    const pasteTab = page.getByRole("tab", { name: /paste/i });
    if ((await pasteTab.count()) > 0) {
      await pasteTab.click();
      await page.waitForTimeout(400);
      console.log("Switched to Paste tab");
    }

    // Find textarea
    const textarea = page.locator("textarea").first();
    if ((await textarea.count()) > 0) {
      await textarea.fill(IMPORT_TEXT);
      console.log("Text pasted into textarea");
      await page.waitForTimeout(300);
    } else {
      console.log("No textarea found");
      const inputs = await page
        .locator("input[type='text'], textarea")
        .allTextContents();
      console.log("Text inputs:", inputs);
    }

    await page.screenshot({ path: "/tmp/step6-filled.png" });
    console.log("Filled form: /tmp/step6-filled.png");

    // ── Step 7: Click Import/Extract ──────────────────────────────────────
    console.log("\n=== STEP 7: Click Extract/Import ===");
    const extractBtn = page
      .getByRole("button", { name: /import text|extract|import/i })
      .last();

    if ((await extractBtn.count()) > 0) {
      await extractBtn.click();
      // Wait up to 90s — local LLM extraction can be slow
      console.log("Clicked extract button, waiting up to 90s for AI...");
      await page.waitForTimeout(90000);
    } else {
      console.log("No extract button found");
      const allBtns = await page.locator("button").allTextContents();
      console.log("Available buttons:", allBtns);
    }

    await page.screenshot({ path: "/tmp/step7-after-extract.png" });
    console.log("After extraction: /tmp/step7-after-extract.png");
  }

  // ── Step 8: API-based extraction (always run as verification) ─────────────
  console.log("\n=== STEP 8: API extraction verification ===");
  const extractResult = await page.evaluate(async (text) => {
    const prompt = `Extract architectural components from the following document:\n\n${text}`;
    const r = await fetch("/api/ai/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ prompt, documentType: "auto" }),
    });
    const status = r.status;
    const body = await r.text();
    return { status, body: body.slice(0, 1000), ok: r.ok };
  }, IMPORT_TEXT);

  console.log(`Extract API → status: ${extractResult.status}`);
  console.log(`Extract API → body: ${extractResult.body}`);

  if (!extractResult.ok) {
    console.log("Extract API FAILED");
  } else {
    // Parse the result
    try {
      const parsed = JSON.parse(extractResult.body);
      const data = parsed.data ?? parsed;
      console.log("Extracted data keys:", Object.keys(data));
      if (data.components)
        console.log(
          `Extracted ${data.components.length} components:`,
          data.components.map((c: { name: string }) => c.name),
        );
    } catch {
      console.log("Raw response (not JSON):", extractResult.body.slice(0, 500));
    }
  }

  // ── Step 9: AI threat suggestion ─────────────────────────────────────────
  console.log("\n=== STEP 9: AI threat suggestion ===");

  // Navigate back to canvas
  await page.goto(`/models/${modelId}`);
  try {
    await page.waitForSelector('[data-testid="rf__wrapper"]', {
      timeout: 20000,
      state: "visible",
    });
  } catch {
    console.log("Canvas did not load on return");
  }
  await page.waitForLoadState("networkidle");

  const discardBtn2 = page.getByRole("button", { name: /discard/i });
  if ((await discardBtn2.count()) > 0) await discardBtn2.click();

  // Look for the threat suggestion button
  const threatBtnSelectors = [
    'button:has-text("Suggest Threats")',
    'button:has-text("Analyze")',
    'button:has-text("Run Analysis")',
    '[aria-label*="threat" i]',
    '[data-testid*="suggest" i]',
    '[data-testid*="analyze" i]',
    'button:has-text("AI")',
  ];

  let threatBtn = null;
  for (const sel of threatBtnSelectors) {
    const el = page.locator(sel).first();
    if ((await el.count()) > 0) {
      const text = await el.textContent();
      console.log(`Found threat button: "${text}" (${sel})`);
      threatBtn = el;
      break;
    }
  }

  if (!threatBtn) {
    const allBtns = await page.locator("button").allTextContents();
    console.log("All visible buttons:", allBtns.slice(0, 20));
    await page.screenshot({ path: "/tmp/step9-no-threat-btn.png" });
    console.log("No threat button found: /tmp/step9-no-threat-btn.png");
  } else {
    await threatBtn.click();
    console.log("Clicked threat suggestion button, waiting up to 30s...");
    await page.waitForTimeout(30000);

    await page.screenshot({ path: "/tmp/step9-threats.png" });
    console.log("Threats result: /tmp/step9-threats.png");

    // Check threat count
    const threatCards = page.locator(
      '[data-testid*="threat"], .threat-card, [class*="threat"]',
    );
    const count = await threatCards.count();
    console.log(`Visible threat elements: ${count}`);
  }

  // ── Step 10: Also test via API ────────────────────────────────────────────
  console.log("\n=== STEP 10: Threat suggestion API test ===");
  const suggestResult = await page.evaluate(async (id) => {
    const r = await fetch(`/api/threat-models/${id}/ai/suggest-threats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    });
    const status = r.status;
    const body = await r.text();
    return { status, body: body.slice(0, 800), ok: r.ok };
  }, modelId);

  console.log(`Suggest threats API → status: ${suggestResult.status}`);
  console.log(`Suggest threats API → body: ${suggestResult.body}`);

  // ── Final report ─────────────────────────────────────────────────────────
  console.log("\n=== FINAL REPORT ===");
  console.log(`Console errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) console.log("Errors:", consoleErrors);
  console.log(`Network issues (4xx/5xx/429): ${networkIssues.length}`);
  if (networkIssues.length > 0) console.log("Network:", networkIssues);
  console.log(`Model ID used: ${modelId}`);

  await page.screenshot({ path: "/tmp/final-state.png" });
  console.log("Final screenshot: /tmp/final-state.png");
});
