import { test as setup } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

/**
 * Playwright auth setup project.
 *
 * Runs once before the `authenticated` project (declared as its dependency in
 * playwright.config.ts). Logs in through the real login UI using the seeded
 * admin account, then persists the browser session so authenticated specs start
 * already logged in — no per-spec login, no rate-limit pressure.
 *
 * Credentials come from E2E_TEST_EMAIL / E2E_TEST_PASSWORD, which must match the
 * admin seeded by `server` → `npm run setup:cli` against the shared DATABASE_URL.
 * Locally these default to the same values the auth fixture uses.
 *
 * The session is written to frontend/.auth/user.json — the SAME path the
 * existing e2e/fixtures/auth.ts fixture reads (`../../.auth/user.json`). Writing
 * it here means both the project-level `storageState` AND the fixture's
 * `hasValidAuthState()` reuse this single login, so the 16 existing authenticated
 * specs work unchanged.
 */

// Resolve to frontend/.auth/user.json (e2e/ -> frontend/).
export const STORAGE_STATE = path.join(__dirname, "..", ".auth", "user.json");

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || "test@example.com";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || "testpassword123";

setup("authenticate", async ({ page }) => {
  // First hit on the dev server compiles /login and /dashboard on demand.
  setup.setTimeout(90_000);
  // Ensure the .auth directory exists before saving state.
  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });

  // Start from a clean session to avoid stale NextAuth JWT decryption errors.
  await page.context().clearCookies();

  // networkidle: submitting before the form hydrates posts without the CSRF
  // token, and NextAuth bounces back to /login?error=MissingCSRF.
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');

  // NextAuth redirects to / or /dashboard on success. Wait for the login form
  // to disappear (credentials accepted), then confirm a protected route loads.
  await page
    .waitForSelector('input[type="email"]', {
      state: "hidden",
      timeout: 30_000,
    })
    .catch(() => {});

  await page.goto("/dashboard", { waitUntil: "networkidle" });

  if (page.url().includes("/login")) {
    throw new Error(
      "auth.setup: login failed — still on /login after submit. " +
        "Verify E2E_TEST_EMAIL/E2E_TEST_PASSWORD match the seeded admin (npm run setup:cli).",
    );
  }

  await page.context().storageState({ path: STORAGE_STATE });
});
