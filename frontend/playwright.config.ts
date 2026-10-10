import { defineConfig, devices } from "@playwright/test";
import * as path from "path";
import { AUTH_FILE } from "./e2e/global-setup";

/**
 * Playwright E2E Test Configuration
 *
 * Local (self-booting) runs — `npm run test:e2e`:
 *   The `webServer` block boots BOTH the Fastify backend (:3001) and the Next.js
 *   frontend (:3000) against a shared SQLite DB, so `smoke` + `authenticated`
 *   run end-to-end with no manual server juggling. Seed an admin first:
 *     cd server && npm run setup:cli -- \
 *       --admin-email test@example.com --admin-password 'TestPassword123!' \
 *       --org-name 'E2E Org' --org-slug e2e-org
 *   then: cd frontend && npm run test:e2e -- --project=smoke
 *
 * Authenticated tests log in once via the `setup` project (auth.setup.ts) and
 * share the saved session. Credentials:
 *   E2E_TEST_EMAIL  (default test@example.com)
 *   E2E_TEST_PASSWORD (default TestPassword123!)
 *
 * Prod-targeted projects (product-tour, use-cases, audits, api-contracts,
 * flows, smoke-prod) run against TOUR_BASE_URL (default prod). When TOUR_BASE_URL
 * is set the local webServer is disabled.
 *
 * The demo login is READ-ONLY on prod. Specs that write (product tours,
 * use-cases, api-contracts, the save-canvas smoke) sign in as
 *   E2E_WRITER_EMAIL / E2E_WRITER_PASSWORD
 * — a separate account with its own organization — and skip on prod when those
 * are unset. See e2e/accounts.ts.
 */

// Shared DB + auth env for the self-booted local/CI stack. Defaults keep a
// zero-config local run working; CI overrides DATABASE_URL / secrets / creds.
const E2E_DB_URL = process.env.DATABASE_URL || "file:./e2e.db";
const E2E_AUTH_SECRET =
  process.env.AUTH_SECRET || "e2e-insecure-test-secret-change-me";
const E2E_JWT_SECRET = process.env.JWT_SECRET || E2E_AUTH_SECRET;
const E2E_EMAIL = process.env.E2E_TEST_EMAIL || "test@example.com";
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD || "TestPassword123!";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
// Collaboration websocket. The frontend (:3000) reaches the Fastify `/ws` on the
// backend (:3001); without this the y-websocket client defaults to the page host
// (:3000), where there is no ws server, so collab never connects in e2e. Derive
// it from API_URL (http→ws) unless overridden.
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || API_URL.replace(/^http/, "ws");

// storageState written by the `setup` project (auth.setup.ts) — frontend/.auth/user.json.
const SETUP_STATE = path.join(__dirname, ".auth", "user.json");

// Subdirectories whose specs target prod (TOUR_BASE_URL) and own their own
// projects below. The `smoke` project's testDir is ./e2e, so without these
// ignores it would ALSO sweep these prod specs in and run them against
// localhost — guaranteed failures. Keep smoke to no-auth localhost specs only.
const PROD_DIRS = [
  "**/authenticated/**",
  "**/product-tour/**",
  "**/use-cases/**",
  "**/audits/**",
  "**/api-contracts/**",
  "**/flows/**",
  "**/smoke/**",
  "**/auth.setup.ts",
  // Root-level specs that target prod (hardcoded prod URL and/or a prod
  // storageState auth file) — exclude from localhost smoke.
  "**/qa-canvas-debug.spec.ts",
  "**/manual-doc-import-flow.spec.ts",
  // Heavyweight exploratory flow (doc import → AI threat generation): needs LLM +
  // Redis/BullMQ infra absent from the localhost smoke env, and runs ~4 min. Not
  // a deterministic smoke gate — run it where the AI stack is available.
  "**/exploratory-flow.spec.ts",
];

export default defineConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { open: "never" }],
    ["list"],
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  projects: [
    // Auth setup — logs in once, saves storageState for the authenticated project.
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // Smoke tests (no auth required) — localhost only, prod dirs excluded.
    {
      name: "smoke",
      testDir: "./e2e",
      testIgnore: PROD_DIRS,
      use: { ...devices["Desktop Chrome"] },
    },
    // Authenticated tests — reuse the session saved by `setup`. Sequential to
    // avoid rate limits.
    {
      name: "authenticated",
      testDir: "./e2e/authenticated",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: SETUP_STATE },
      fullyParallel: false,
    },
    // Product tour — runs against public prod, generates Scribe-style screenshot docs
    {
      name: "product-tour",
      testDir: "./e2e/product-tour",
      testMatch: "**/*.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL:
          process.env.TOUR_BASE_URL || "https://threatforge.bpmforge.com",
        viewport: { width: 1440, height: 900 },
        screenshot: "off", // tours manage their own screenshots
        video: "off",
        trace: "off",
      },
      fullyParallel: false, // sequential so screenshots don't race
      retries: 0,
    },
    // Audits — discovery, label-action, and other reconnaissance tests.
    // Runs against the same base URL as tours. Outputs markdown reports to
    // docs/audits/ rather than asserting pass/fail. Not a CI gate.
    {
      name: "audits",
      testDir: "./e2e/audits",
      testMatch: "**/*.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL:
          process.env.TOUR_BASE_URL || "https://threatforge.bpmforge.com",
        viewport: { width: 1440, height: 900 },
        screenshot: "off",
        video: "off",
        trace: "off",
      },
      fullyParallel: false,
      retries: 0,
    },
    // Use-case E2E tests — one spec per product use case. Quality gate for
    // demo and ship readiness. Runs against configurable base URL (default prod).
    // CI should run these on every PR (P0 only) and nightly (full suite).
    {
      name: "use-cases",
      testDir: "./e2e/use-cases",
      testMatch: "**/*.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL:
          process.env.TOUR_BASE_URL || "https://threatforge.bpmforge.com",
        viewport: { width: 1440, height: 900 },
        screenshot: "only-on-failure",
        video: "off",
        trace: "on-first-retry",
        // Pre-loaded session state from globalSetup — avoids 200+ login calls
        // which trip the rate limiter. login() in _fixtures detects this and skips.
        storageState: AUTH_FILE,
      },
      fullyParallel: false, // sequential — tests may create shared fixture state
      workers: 1, // Enforce single-worker so tests sharing the demo-tour
      // account don't race each other — notably deleteAllModels in UC-07/11
      // used to wipe models from sibling tests running on parallel workers.
      retries: 2, // React 19 + Next.js SSR hydration mismatches (#418) fire
      // intermittently on first page load when TanStack Query cache has data
      // from prior tests. These are performance issues (not functional regressions)
      // — pages render correctly but React does a full client re-render.
      // We're progressively fixing them with mounted guards; 2 retries ensures
      // the suite is green while fixes land.
    },
    // Smoke tests against prod — health checks, auth, and critical regression
    // paths. Fast (<2 min), no LLM calls. Run before any deploy promotion.
    {
      name: "smoke-prod",
      testDir: "./e2e/smoke",
      testMatch: "**/*.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL:
          process.env.TOUR_BASE_URL || "https://threatforge.bpmforge.com",
        viewport: { width: 1440, height: 900 },
        screenshot: "only-on-failure",
        video: "off",
        trace: "on-first-retry",
      },
      // Every smoke test logs in as the same demo account; parallel workers
      // trip the login rate limiter and the canvas tests time out.
      workers: 1,
      fullyParallel: false,
      retries: 1,
    },
    // Reseed the demo account (idempotent: creates only what is missing, never
    // deletes). Same auth and single-worker rules as smoke-prod. Run after any
    // use-cases run that touched the public host.
    {
      name: "reseed-demo",
      testDir: "./e2e/tools",
      testMatch: "reseed-demo.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL:
          process.env.TOUR_BASE_URL || "https://threatforge.bpmforge.com",
        storageState: AUTH_FILE,
      },
      workers: 1,
      fullyParallel: false,
      retries: 0,
    },
    // API contract tests — verify request/response shapes from API_CONTRACTS.md.
    // Each test creates and tears down its own fixtures. Workers=1 to share the
    // single authenticated browser context without racing on the demo account.
    {
      name: "api-contracts",
      testDir: "./e2e/api-contracts",
      testMatch: "**/*.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL:
          process.env.TOUR_BASE_URL || "https://threatforge.bpmforge.com",
        viewport: { width: 1440, height: 900 },
        screenshot: "only-on-failure",
        video: "off",
        trace: "on-first-retry",
      },
      fullyParallel: false,
      workers: 1,
      retries: 1,
      timeout: 30_000,
    },
    // Flow tests — multi-step scenarios following SEQUENCE_DIAGRAMS.md.
    // Some tests make real LLM calls (90s timeout). Workers=1 — tests share
    // the demo-tour account. Skip LLM tests in CI: --grep-invert "LLM"
    {
      name: "flows",
      testDir: "./e2e/flows",
      testMatch: "**/*.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL:
          process.env.TOUR_BASE_URL || "https://threatforge.bpmforge.com",
        viewport: { width: 1440, height: 900 },
        screenshot: "only-on-failure",
        video: "off",
        trace: "on-first-retry",
      },
      fullyParallel: false,
      workers: 1,
      retries: 0,
      timeout: 120_000,
    },
  ],
  // Self-booting stack for localhost smoke/authenticated runs. Disabled when
  // TOUR_BASE_URL is set (prod-targeted projects supply their own remote URL).
  // Boots the backend (:3001) and frontend (:3000) sharing one SQLite DB.
  // reuseExistingServer: !CI — locally reuse an already-running dev stack; in CI
  // always start fresh.
  webServer: process.env.TOUR_BASE_URL
    ? undefined
    : [
        {
          // Fastify backend. /health returns 200 once ready.
          command: "npm run dev",
          cwd: path.join(__dirname, "..", "server"),
          url: "http://localhost:3001/health",
          reuseExistingServer: !process.env.CI,
          timeout: 180 * 1000,
          stdout: "pipe",
          stderr: "pipe",
          env: {
            PORT: "3001",
            HOST: "0.0.0.0",
            NODE_ENV: "test",
            DATABASE_URL: E2E_DB_URL,
            JWT_SECRET: E2E_JWT_SECRET,
            CORS_ORIGIN: "http://localhost:3000",
            PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "yes",
          },
        },
        {
          // Next.js frontend. Shares the same DB + auth secret as the backend.
          command: "npm run dev",
          cwd: __dirname,
          url: "http://localhost:3000",
          reuseExistingServer: !process.env.CI,
          timeout: 180 * 1000,
          stdout: "pipe",
          stderr: "pipe",
          env: {
            DATABASE_URL: E2E_DB_URL,
            AUTH_SECRET: E2E_AUTH_SECRET,
            AUTH_URL: "http://localhost:3000",
            NEXT_PUBLIC_API_URL: API_URL,
            NEXT_PUBLIC_WS_URL: WS_URL,
            E2E_TEST_EMAIL: E2E_EMAIL,
            E2E_TEST_PASSWORD: E2E_PASSWORD,
          },
        },
      ],
  // Output directories
  outputDir: "./test-results",
});
