/**
 * Playwright global setup — runs once before any test worker starts.
 *
 * Authenticates as the writer account (../accounts.ts) and saves the browser storage state
 * (session cookie) to e2e/.auth/user.json. All use-case tests then start with
 * that state pre-loaded, so individual login() calls become a no-op instead
 * of hitting the login endpoint 200+ times and triggering rate limits.
 */
import { chromium, type FullConfig } from "@playwright/test";
import { WRITER_EMAIL, WRITER_PASSWORD, writerSkipReason } from "./accounts";
import path from "path";

export const AUTH_FILE = path.join(__dirname, ".auth/user.json");

export default async function globalSetup(_config: FullConfig) {
  // Skip the prod login when running the self-booted localhost stack
  // (smoke + authenticated nightly / `npm run test:e2e`). Those projects
  // authenticate via the `setup` project (auth.setup.ts) against the local
  // servers, not via this prod-targeted global setup. Without this guard,
  // globalSetup would try to reach prod before any local test and fail the run.
  // The prod-targeted projects (use-cases) leave the flag unset so they still
  // get their pre-warmed AUTH_FILE.
  if (process.env.E2E_SKIP_GLOBAL_SETUP === "1") {
    return;
  }

  // Always target the same URL the use-cases project targets.
  // config.projects[0] is the smoke project (localhost) — don't use that.
  const baseURL =
    process.env.TOUR_BASE_URL || "https://threatforge.bpmforge.com";

  const skip = writerSkipReason();
  if (skip) {
    console.warn(
      `Global setup: ${skip}. Specs that write will be rejected (403 READ_ONLY_ACCOUNT).`,
    );
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${baseURL}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', WRITER_EMAIL);
  await page.fill('input[type="password"]', WRITER_PASSWORD);
  await page.click('button[type="submit"]');

  // NextAuth may redirect to / or /dashboard depending on callbackUrl.
  // Wait for the login form to disappear (auth completed), then navigate to dashboard.
  await page
    .waitForSelector('input[type="email"]', { state: "hidden", timeout: 20000 })
    .catch(() => {});
  await page.goto(`${baseURL}/dashboard`, { waitUntil: "networkidle" });

  // Verify we are authenticated (not redirected back to /login)
  if (page.url().includes("/login")) {
    throw new Error(
      `Global setup: login failed — still on login page after submit. Check E2E_WRITER_EMAIL/E2E_WRITER_PASSWORD.`,
    );
  }

  await page.context().storageState({ path: AUTH_FILE });
  await browser.close();
}
