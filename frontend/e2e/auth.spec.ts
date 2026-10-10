import { test, expect } from "@playwright/test";

/**
 * Authentication Flow Tests
 *
 * Tests the login, registration, and auth redirect flows.
 */
test.describe("Authentication", () => {
  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");

    // Check page title
    await expect(page.locator("h1")).toContainText("ThreatForge");
    await expect(page.locator("h2")).toContainText("Sign in");

    // Check form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText(
      "Sign in",
    );

    // Check register link
    await expect(page.locator('a[href="/register"]')).toContainText(
      "Create one",
    );
  });

  test("register page renders correctly", async ({ page }) => {
    await page.goto("/register");

    // Check page title
    await expect(page.locator("h1")).toContainText("ThreatForge");
    await expect(page.locator("h2")).toContainText("Create your account");

    // Check form elements
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText(
      "Create account",
    );

    // Check login link
    await expect(page.locator('a[href="/login"]')).toContainText("Sign in");
  });

  test("unauthenticated user is redirected to login", async ({ page }) => {
    // Try to access protected route
    await page.goto("/dashboard");

    // Should redirect to login with callback
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });

  test("login form shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill invalid credentials
    await page.fill('input[type="email"]', "invalid@example.com");
    await page.fill('input[type="password"]', "wrongpassword");

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error message
    await expect(page.locator("text=Invalid email or password")).toBeVisible({
      timeout: 5000,
    });
  });

  test("register form validates password length", async ({ page }) => {
    await page.goto("/register");

    // Fill form with short password
    await page.fill('input[name="name"]', "Test User");
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "short");

    // A too-short password fails the policy, so the submit button stays disabled.
    // (The register form gates on `isPasswordValid`; it no longer renders the
    // PasswordStrength requirement list inline, so assert the behaviour, not the
    // "At least 12 characters" copy.)
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test("register form validates password match", async ({ page }) => {
    await page.goto("/register");

    // Fill form with mismatched passwords (using a strong password that passes requirements)
    await page.fill('input[name="name"]', "Test User");
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "ValidPassword123!");
    await page.fill('input[name="confirmPassword"]', "DifferentPassword123!");

    // Client-side validation shows mismatch error immediately
    await expect(page.locator("text=Passwords do not match")).toBeVisible();

    // Verify submit button is disabled due to validation
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test("navigate from login to register", async ({ page }) => {
    await page.goto("/login");

    // Click register link
    await page.click('a[href="/register"]');

    // Should be on register page
    await expect(page).toHaveURL("/register");
    await expect(page.locator("h2")).toContainText("Create your account");
  });

  test("navigate from register to login", async ({ page }) => {
    await page.goto("/register");

    // Click login link
    await page.click('a[href="/login"]');

    // Should be on login page
    await expect(page).toHaveURL("/login");
    await expect(page.locator("h2")).toContainText("Sign in");
  });
});
