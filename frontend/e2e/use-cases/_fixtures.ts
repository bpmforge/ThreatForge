/**
 * Use-Case Test Fixtures
 *
 * Shared helpers for the use-case E2E test suite. Every spec imports from here
 * for login, model creation, cleanup, and cross-cutting assertions.
 *
 * Design principle: each test creates its own data via these helpers so tests
 * are independent and can run in any order. Helpers use the session cookie from
 * the Playwright page context — no separate API client needed.
 *
 * AUTOMATIC CLEAN CHECK:
 * Every test using `{ page }` from this module automatically gets:
 *   - Console error detection (browser console.error)
 *   - Uncaught JS exception detection (pageerror — React crashes, unhandled promises)
 *   - 5xx / 429 network error detection
 * The test fails with a clear message if any of these fire during the test.
 * Use withCleanCheck() directly only when you need a custom allow-list.
 */
import { test as base, expect, type Page } from "@playwright/test";
import { PUBLIC_HOST } from "../demo-models";

// ── Credentials ──────────────────────────────────────────────────────────────
// Use cases create and delete models, so they run as the writer account; the
// demo login is read-only on the public host. See ../accounts.ts.
import { WRITER_EMAIL, WRITER_PASSWORD, writerSkipReason } from "../accounts";
export { WRITER_EMAIL };

/**
 * AI_AVAILABLE — set AI_AVAILABLE=true in the environment when running tests
 * against an instance that has a real LLM configured (e.g., local dev with
 * LM Studio, or prod with Claude). When true, AI tests fail hard instead of
 * silently skipping. Default: false (CI-safe).
 *
 * Usage in tests:
 *   if (!AI_AVAILABLE) { test.skip(); return; }   // always skip in CI
 *   // OR:
 *   if (result.length === 0) {
 *     if (AI_AVAILABLE) throw new Error("AI enabled but returned no results");
 *     test.skip(); return;
 *   }
 */
export const AI_AVAILABLE = process.env.AI_AVAILABLE === "true";

// ── Login ────────────────────────────────────────────────────────────────────
export async function login(
  page: Page,
  email = WRITER_EMAIL,
  password = WRITER_PASSWORD,
) {
  // Fast path: storageState from globalSetup pre-loads the session cookie.
  // Navigate to /dashboard — if the cookie is valid we skip the login form,
  // avoiding 200+ POST /api/auth/login calls that trip the rate limiter.
  const currentUrl = page.url();
  if (
    currentUrl.includes("/dashboard") ||
    currentUrl.includes("/models/") ||
    currentUrl.includes("/settings")
  ) {
    return;
  }

  try {
    await page.goto("/dashboard", {
      waitUntil: "domcontentloaded",
      timeout: 8000,
    });
    if (!page.url().includes("/login")) {
      await page.waitForLoadState("networkidle");
      return;
    }
  } catch {
    // navigation failed — fall through to full login
  }

  await page.goto("/login");
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}

// ── API helpers (run inside page context, use session cookie) ────────────────
export async function apiGet<T = unknown>(page: Page, url: string): Promise<T> {
  return page.evaluate(async (u) => {
    const r = await fetch(u, { credentials: "include" });
    if (!r.ok) throw new Error(`GET ${u} → ${r.status}`);
    const body = await r.json();
    return body.data ?? body;
  }, url) as Promise<T>;
}

export async function apiPost<T = unknown>(
  page: Page,
  url: string,
  body: unknown = {},
): Promise<T> {
  return page.evaluate(
    async ({ u, b }) => {
      const r = await fetch(u, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(b),
      });
      if (!r.ok)
        throw new Error(
          `POST ${u} → ${r.status}: ${(await r.text()).slice(0, 200)}`,
        );
      const json = await r.json();
      return json.data ?? json;
    },
    { u: url, b: body },
  ) as Promise<T>;
}

export async function apiPatch<T = unknown>(
  page: Page,
  url: string,
  body: unknown = {},
): Promise<T> {
  return page.evaluate(
    async ({ u, b }) => {
      const r = await fetch(u, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(b),
      });
      if (!r.ok)
        throw new Error(
          `PATCH ${u} → ${r.status}: ${(await r.text()).slice(0, 200)}`,
        );
      const json = await r.json();
      return json.data ?? json;
    },
    { u: url, b: body },
  ) as Promise<T>;
}

export async function apiDelete(page: Page, url: string): Promise<void> {
  await page.evaluate(async (u) => {
    const r = await fetch(u, { method: "DELETE", credentials: "include" });
    if (!r.ok && r.status !== 404) throw new Error(`DELETE ${u} → ${r.status}`);
  }, url);
}

// ── Model helpers ────────────────────────────────────────────────────────────
export interface ModelInfo {
  id: string;
  name: string;
}

export async function findModel(
  page: Page,
  nameSubstring: string,
): Promise<ModelInfo | null> {
  const models = await apiGet<ModelInfo[]>(page, "/api/threat-models");
  const arr = Array.isArray(models) ? models : [];
  return arr.find((m) => m.name.includes(nameSubstring)) ?? null;
}

export async function createModel(
  page: Page,
  name: string,
): Promise<ModelInfo> {
  return apiPost<ModelInfo>(page, "/api/threat-models", { name });
}

export async function deleteModel(page: Page, id: string): Promise<void> {
  await apiDelete(page, `/api/threat-models/${id}`);
}

export async function deleteAllModels(page: Page): Promise<void> {
  // Guard: this empties the whole account. Against the public host that is
  // the demo account every sales demo and the smoke gate depend on, and the
  // 09-04 smoke failure was exactly this. Refuse there unless the caller opts
  // in explicitly; run --project=reseed-demo afterwards to restore it.
  const host = new URL(page.url() || "http://localhost/").hostname;
  if (host === PUBLIC_HOST && process.env.E2E_ALLOW_ACCOUNT_WIPE !== "1") {
    throw new Error(
      `deleteAllModels refused on ${PUBLIC_HOST}: it would empty the demo account. ` +
        "Set E2E_ALLOW_ACCOUNT_WIPE=1 only if you mean it.",
    );
  }
  const models = await apiGet<ModelInfo[]>(page, "/api/threat-models");
  const arr = Array.isArray(models) ? models : [];
  for (const m of arr) {
    await deleteModel(page, m.id);
  }
}

// ── AI job polling helper ────────────────────────────────────────────────────
/**
 * Poll a BullMQ AI job until it reaches a terminal state (COMPLETED or FAILED).
 * Uses expect.poll() so failures show the actual vs expected value.
 *
 * @example
 * const { jobId } = await apiPost(page, `/api/threat-models/${id}/ai/suggest-threats`, {});
 * const job = await waitForJob(page, jobId, { timeout: 90_000 });
 * expect(job.status).toBe('COMPLETED');
 */
export async function waitForJob(
  page: Page,
  jobId: string,
  options: { timeout?: number } = {},
): Promise<{ status: string; result?: unknown; error?: string }> {
  const timeout = options.timeout ?? 90_000;
  let lastJob: { status: string; result?: unknown; error?: string } = {
    status: "PENDING",
  };

  await expect
    .poll(
      async () => {
        const job = await apiGet<{
          status: string;
          result?: unknown;
          error?: string;
        }>(page, `/api/ai-jobs/${jobId}`);
        lastJob = job;
        return job.status;
      },
      {
        message: `AI job ${jobId} should reach COMPLETED or FAILED within ${timeout}ms`,
        timeout,
        intervals: [1000, 2000, 5000, 10000],
      },
    )
    .toMatch(/^(COMPLETED|FAILED)$/);

  return lastJob;
}

// ── Canvas helpers ───────────────────────────────────────────────────────────
interface NodeSpec {
  id: string;
  label: string;
  type: string;
  position: { x: number; y: number };
  trustLevel?: string;
}

export function makeNode(n: NodeSpec) {
  return {
    id: n.id,
    type: "component",
    position: n.position,
    data: {
      label: n.label,
      type: n.type,
      trustLevel: n.trustLevel || "INTERNAL",
    },
  };
}

export function makeEdge(
  id: string,
  source: string,
  target: string,
  opts: Partial<{ protocol: string; encrypted: boolean; auth: string }> = {},
) {
  return {
    id,
    source,
    target,
    type: "security",
    data: {
      protocol: opts.protocol || "HTTPS",
      encrypted: opts.encrypted ?? true,
      authenticated: (opts.auth ?? "Bearer Token") !== "None",
      authentication: opts.auth || "Bearer Token",
      dataClassifications: [],
    },
  };
}

export function makeBoundary(
  id: string,
  label: string,
  position: { x: number; y: number },
  size: { width: number; height: number },
) {
  return {
    id,
    type: "boundary",
    position,
    style: { width: size.width, height: size.height },
    zIndex: -1000,
    data: { label, trustLevel: "INTERNAL" },
  };
}

export async function saveCanvas(
  page: Page,
  modelId: string,
  nodes: object[],
  edges: object[] = [],
) {
  await apiPost(page, `/api/threat-models/${modelId}/save-canvas`, {
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
  });
}

export async function navigateToModel(page: Page, modelId: string) {
  // Clear auto-save localStorage BEFORE loading the page to prevent the
  // "Restore Unsaved Changes?" dialog from blocking the canvas.
  await page.goto("/dashboard"); // need a page loaded to run evaluate
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
  // Bumped from 15s: cold Cloudflare/SSR paths can push the initial render
  // past 15s (observed when a container swap coincides with the first hit).
  await page.waitForSelector('[data-testid="rf__wrapper"]', {
    state: "visible",
    timeout: 30000,
  });
  await page.waitForLoadState("networkidle");

  // Safety net: dismiss the dialog if it still appears despite clearing
  const discardBtn = page.getByRole("button", { name: /discard/i });
  if ((await discardBtn.count()) > 0) {
    await discardBtn.click();
    await page.waitForTimeout(300);
  }

  // Wait for React Flow to actually hydrate nodes. `rf__wrapper` appears
  // before the CRDT sync completes; returning here too early means the next
  // `toBeVisible` check on a specific node label can race on cold starts.
  // If the model has no nodes (blank canvas tests), fall through after 2s.
  await page
    .waitForSelector(".react-flow__node", {
      state: "visible",
      timeout: 15000,
    })
    .catch(() => {});

  await page.waitForTimeout(500);
}

// ── Online Checkout fixture ──────────────────────────────────────────────────
// Pre-built 5-component system for tests that need a populated model.
export const ONLINE_CHECKOUT = {
  nodes: [
    makeNode({
      id: "n-customer",
      label: "Customer",
      type: "ACTOR",
      position: { x: 30, y: 220 },
      trustLevel: "EXTERNAL",
    }),
    makeNode({
      id: "n-web",
      label: "Checkout Web",
      type: "WEB_APP",
      position: { x: 230, y: 220 },
    }),
    makeNode({
      id: "n-api",
      label: "Payment API",
      type: "API",
      position: { x: 450, y: 220 },
    }),
    makeNode({
      id: "n-stripe",
      label: "Stripe",
      type: "EXTERNAL_ENTITY",
      position: { x: 680, y: 80 },
      trustLevel: "EXTERNAL",
    }),
    makeNode({
      id: "n-orders",
      label: "Orders Database",
      type: "DATA_STORE",
      position: { x: 450, y: 420 },
      trustLevel: "RESTRICTED",
    }),
    makeBoundary(
      "b-internal",
      "Internal Services",
      { x: 200, y: 160 },
      { width: 540, height: 360 },
    ),
  ],
  edges: [
    makeEdge("e-1", "n-customer", "n-web", { auth: "None" }),
    makeEdge("e-2", "n-web", "n-api", { auth: "Bearer Token" }),
    makeEdge("e-3", "n-api", "n-stripe", { auth: "API Key" }),
    makeEdge("e-4", "n-api", "n-orders", { protocol: "TLS", auth: "mTLS" }),
  ],
};

export async function createOnlineCheckoutModel(page: Page): Promise<string> {
  const model = await createModel(page, "Test — Online Checkout");
  await saveCanvas(
    page,
    model.id,
    ONLINE_CHECKOUT.nodes,
    ONLINE_CHECKOUT.edges,
  );
  return model.id;
}

// ── Cross-cutting assertions ─────────────────────────────────────────────────

interface CleanCheckOptions {
  allowedConsoleErrors?: RegExp[];
  allowedNetworkErrors?: number[];
}

/**
 * withCleanCheck() — manual clean check for tests needing a custom allow-list.
 *
 * Most tests do NOT need to call this directly. The `page` fixture override
 * in the `test` export below automatically attaches a clean check to every
 * test. Only use withCleanCheck() when you need allowedConsoleErrors or
 * allowedNetworkErrors.
 *
 * @example
 * // Allow a specific expected console error:
 * const check = withCleanCheck({ allowedConsoleErrors: [/ResizeObserver/] });
 * check.attach(page);
 * // ... test code ...
 * await check.expectClean();
 */
export function withCleanCheck(defaultOpts?: CleanCheckOptions) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const networkErrors: Array<{ status: number; url: string }> = [];

  return {
    attach(page: Page) {
      // Browser console.error calls
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const text = msg.text();
          // Known cosmetic noise — not real errors
          if (text.includes("cloudflareinsights")) return;
          if (text.includes("Download the React DevTools")) return;
          if (text.includes("favicon")) return;
          if (text.includes("Content-Security-Policy")) return;
          if (text.includes("ERR_CONNECTION_REFUSED")) return;
          if (text.includes("net::ERR_")) return;
          if (text.includes("Failed to load resource")) return;
          if (text.includes("Ignoring duplicate")) return;
          if (text.includes("beacon.min.js")) return;
          if (text.includes("Loading the script")) return;
          if (text.includes("violates the following")) return;
          if (text.includes("ResizeObserver")) return;
          // NextAuth background session polling — fires when the /api/auth/session
          // endpoint is slow/unreachable during page load. Not a real auth failure;
          // the cookie session remains valid. See errors.authjs.dev#autherror
          if (text.includes("errors.authjs.dev#autherror")) return;
          if (text.includes("autherror") && text.includes("Failed to fetch"))
            return;
          // NOTE: "Warning:" and "chunk" suppression removed — these hide real
          // React key warnings, deprecated API usage, and bundle load failures.
          // If this surfaces noise, add targeted suppressions here with comments.
          if (text.length < 10) return;
          consoleErrors.push(text.slice(0, 300));
        }
      });

      // Uncaught JS exceptions — React crashes, unhandled promise rejections.
      // These are more serious than console.error; they crash the page entirely.
      page.on("pageerror", (err) => {
        const text = err.message;
        // Ignore known third-party noise
        if (text.includes("ResizeObserver")) return;
        if (text.includes("Non-Error promise rejection")) return;
        pageErrors.push(`[UNCAUGHT] ${text.slice(0, 300)}`);
      });

      // 5xx server errors and 429 rate limits on any network request
      page.on("response", (res) => {
        const status = res.status();
        if (status === 429 || status >= 500) {
          const url = res.url();
          if (url.includes("favicon") || url.includes("_next/static")) return;
          networkErrors.push({
            status,
            url: url.replace(/^https?:\/\/[^/]+/, ""),
          });
        }
      });
    },

    async expectClean(opts?: CleanCheckOptions) {
      const mergedOpts = {
        allowedConsoleErrors: [
          ...(defaultOpts?.allowedConsoleErrors ?? []),
          ...(opts?.allowedConsoleErrors ?? []),
        ],
        allowedNetworkErrors: [
          ...(defaultOpts?.allowedNetworkErrors ?? []),
          ...(opts?.allowedNetworkErrors ?? []),
        ],
      };

      const filteredConsole = consoleErrors.filter(
        (e) => !mergedOpts.allowedConsoleErrors.some((re) => re.test(e)),
      );
      const filteredPage = pageErrors.filter(
        (e) => !mergedOpts.allowedConsoleErrors.some((re) => re.test(e)),
      );
      const filteredNetwork = networkErrors.filter(
        (e) => !mergedOpts.allowedNetworkErrors.includes(e.status),
      );

      expect(
        filteredConsole,
        `Browser console errors detected during test:\n${filteredConsole.join("\n")}`,
      ).toHaveLength(0);

      expect(
        filteredPage,
        `Uncaught JS exceptions (React crashes / unhandled promises):\n${filteredPage.join("\n")}`,
      ).toHaveLength(0);

      expect(
        filteredNetwork,
        `Server errors (5xx/429) detected:\n${filteredNetwork.map((e) => `  ${e.status} ${e.url}`).join("\n")}`,
      ).toHaveLength(0);
    },
  };
}

// ── Extended test fixture ────────────────────────────────────────────────────
// Overrides the base `page` fixture so every test automatically gets clean check
// (console errors, pageerror, 5xx) without any opt-in code in the test itself.
type Fixtures = {
  loggedInPage: Page;
  writerAccount: void;
};

export const test = base.extend<Fixtures>({
  /** Skip, with the reason, where only a read-only demo login is available. */
  writerAccount: [
    async ({}, use, testInfo) => {
      const reason = writerSkipReason();
      testInfo.skip(!!reason, reason ?? "");
      await use();
    },
    { auto: true },
  ],
  /**
   * Overrides the base `page` fixture. Every test using `{ page }` from this
   * module automatically gets console error + pageerror + 5xx detection.
   * No opt-in required in individual tests.
   */
  page: async ({ page }, use) => {
    const check = withCleanCheck();
    check.attach(page);
    await use(page);
    // Teardown: assert no browser errors occurred during the test
    await check.expectClean();
  },

  /**
   * `loggedInPage` — pre-authenticated page. Inherits clean check from the
   * `page` fixture override above (no double-attach needed).
   */
  loggedInPage: async ({ page }, use) => {
    await login(page);
    await use(page);
    // expectClean called by `page` fixture teardown above
  },
});

export { expect };
