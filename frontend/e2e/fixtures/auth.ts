import {
  test as base,
  expect,
  type Page,
  type BrowserContext,
} from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

/**
 * Auth Fixture for E2E Tests
 *
 * Provides authenticated test context using Playwright's storageState.
 * First run will perform actual login, subsequent runs reuse the session.
 */

// Test user credentials - set via environment variables or use defaults for local dev
const TEST_USER_EMAIL = process.env.E2E_TEST_EMAIL || "test@example.com";
const TEST_USER_PASSWORD = process.env.E2E_TEST_PASSWORD || "testpassword123";

// Path to store auth state between test runs
const AUTH_STATE_PATH = path.join(__dirname, "../../.auth/user.json");

/**
 * Ensure the .auth directory exists
 */
function ensureAuthDir() {
  const authDir = path.dirname(AUTH_STATE_PATH);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
}

/**
 * Check if we have a valid stored auth state
 */
function hasValidAuthState(): boolean {
  if (!fs.existsSync(AUTH_STATE_PATH)) {
    return false;
  }

  try {
    const state = JSON.parse(fs.readFileSync(AUTH_STATE_PATH, "utf-8"));
    // Check if state has cookies (basic validity check)
    return state.cookies && state.cookies.length > 0;
  } catch {
    return false;
  }
}

/**
 * Perform login and save auth state
 */
async function loginAndSaveState(page: Page): Promise<boolean> {
  try {
    // Clear any existing cookies to prevent stale session issues
    // This fixes "JWTSessionError: no matching decryption secret" errors
    await page.context().clearCookies();

    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Fill in credentials
    await page.fill('input[type="email"]', TEST_USER_EMAIL);
    await page.fill('input[type="password"]', TEST_USER_PASSWORD);

    // Submit the form
    console.log("Submitting login form...");
    await page.click('button[type="submit"]');

    // Wait for navigation away from login page
    // This could go to dashboard, callback URL, or show an error
    await page.waitForTimeout(3000);

    // Check if login succeeded (not on login page anymore and no error)
    const url = page.url();
    const hasError = await page
      .locator("text=Invalid email or password")
      .isVisible()
      .catch(() => false);
    const pageContent = await page.content();
    const hasCredentialsError =
      pageContent.includes("CredentialsSignin") ||
      pageContent.includes("Invalid credentials");

    console.log("Login attempt - URL after login:", url);
    console.log("Login attempt - hasError:", hasError);
    console.log("Login attempt - hasCredentialsError:", hasCredentialsError);
    console.log("Login attempt - Email used:", TEST_USER_EMAIL);
    console.log("Login attempt - Password length:", TEST_USER_PASSWORD.length);

    if (hasError || url.includes("/login")) {
      console.log(
        "Login failed - check E2E_TEST_EMAIL and E2E_TEST_PASSWORD environment variables",
      );
      console.log("Current URL:", url);
      return false;
    }

    // Save the auth state
    ensureAuthDir();
    await page.context().storageState({ path: AUTH_STATE_PATH });
    console.log("Auth state saved to", AUTH_STATE_PATH);

    return true;
  } catch (error) {
    console.error("Login failed:", error);
    return false;
  }
}

/**
 * Extended test type with authenticated page
 */
type AuthFixtures = {
  /** Authenticated page - already logged in */
  authenticatedPage: Page;
  /** Auth context that can be reused */
  authContext: BrowserContext;
  /** Whether auth is available */
  isAuthenticated: boolean;
};

/**
 * Test fixture that provides an authenticated page
 *
 * Usage:
 * ```ts
 * import { test, expect } from './fixtures/auth';
 *
 * test('can access dashboard', async ({ authenticatedPage }) => {
 *   await authenticatedPage.goto('/dashboard');
 *   await expect(authenticatedPage).not.toHaveURL(/login/);
 * });
 * ```
 */
export const test = base.extend<AuthFixtures>({
  // Provide auth context
  authContext: async ({ browser }, use) => {
    let context: BrowserContext;

    if (hasValidAuthState()) {
      // Reuse existing auth state
      console.log("Using existing auth state from:", AUTH_STATE_PATH);
      context = await browser.newContext({ storageState: AUTH_STATE_PATH });
    } else {
      // Create new context and login
      console.log("No valid auth state, performing login...");
      context = await browser.newContext();
      const page = await context.newPage();

      const loginSuccess = await loginAndSaveState(page);
      await page.close();

      if (!loginSuccess) {
        console.log("Login failed - tests will skip auth-required tests");
        // Keep the context but don't save state
      }
    }

    await use(context);
    await context.close();
  },

  // Provide authenticated page
  authenticatedPage: async ({ authContext }, use) => {
    const page = await authContext.newPage();
    await use(page);
    await page.close();
  },

  // Flag indicating if auth is available
  isAuthenticated: async ({ authContext }, use) => {
    // Try to access a protected route to verify auth
    const page = await authContext.newPage();
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const isAuth = !page.url().includes("/login");
    await page.close();

    await use(isAuth);
  },
});

// Re-export expect for convenience
export { expect };

// Import seed data helpers
import {} from "./seed-data";

/**
 * Extended test type with seeded model
 */
type SeededFixtures = AuthFixtures & {
  /** A model with sample canvas data and threats */
  seededModelId: string | null;
};

/**
 * Test fixture that provides an authenticated page with a seeded model
 */
export const testWithSeededModel = base.extend<SeededFixtures>({
  authContext: async ({ browser }, use) => {
    let context: BrowserContext;

    if (hasValidAuthState()) {
      console.log("Using existing auth state from:", AUTH_STATE_PATH);
      context = await browser.newContext({ storageState: AUTH_STATE_PATH });
    } else {
      console.log("No valid auth state, performing login...");
      context = await browser.newContext();
      const page = await context.newPage();
      const loginSuccess = await loginAndSaveState(page);
      await page.close();

      if (!loginSuccess) {
        console.log("Login failed - tests will skip auth-required tests");
        // Keep context open for tests to handle
      }
    }

    await use(context);
    await context.close();
  },

  authenticatedPage: async ({ authContext }, use) => {
    const page = await authContext.newPage();
    await use(page);
    await page.close();
  },

  isAuthenticated: async ({ authContext }, use) => {
    const page = await authContext.newPage();
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const isAuth = !page.url().includes("/login");
    await page.close();
    await use(isAuth);
  },

  seededModelId: async ({ authenticatedPage, isAuthenticated }, use) => {
    if (!isAuthenticated) {
      await use(null);
      return;
    }

    // Create a model with canvas data via the UI
    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForLoadState("networkidle");

    // Click "New Model" button
    const newModelBtn = authenticatedPage
      .locator('button:has-text("New Model")')
      .first();
    if (await newModelBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newModelBtn.click();
      await authenticatedPage.waitForTimeout(500);

      // Fill in model name
      const nameInput = authenticatedPage
        .locator('input#name, input[placeholder*="Model"]')
        .first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill("E2E Seeded Model");

        // Submit the form
        const createBtn = authenticatedPage
          .locator('button:has-text("Create")')
          .first();
        await createBtn.click();

        // Wait for navigation to model page
        await authenticatedPage
          .waitForURL(/\/models\//, { timeout: 10000 })
          .catch(() => {});

        // Extract model ID from URL
        const url = authenticatedPage.url();
        const match = url.match(/\/models\/([^/]+)/);
        const modelId = match ? match[1] : null;

        await use(modelId);
        return;
      }
    }

    await use(null);
  },
});

/**
 * Helper to skip test if not authenticated
 */
export function skipIfNotAuthenticated(isAuthenticated: boolean) {
  if (!isAuthenticated) {
    test.skip();
  }
}

/**
 * Helper to clear auth state (for testing logout, etc.)
 */
export function clearAuthState() {
  if (fs.existsSync(AUTH_STATE_PATH)) {
    fs.unlinkSync(AUTH_STATE_PATH);
  }
}

/**
 * Setup function to run before all tests (in global setup)
 * This performs the initial login
 */
export async function globalAuthSetup(
  browser: import("@playwright/test").Browser,
) {
  ensureAuthDir();

  if (hasValidAuthState()) {
    console.log("Using existing auth state");
    return;
  }

  console.log("Performing fresh login...");
  const context = await browser.newContext();
  const page = await context.newPage();

  const success = await loginAndSaveState(page);
  if (success) {
    console.log("Auth setup complete");
  } else {
    console.warn("Auth setup failed - authenticated tests will be skipped");
  }

  await context.close();
}
