/**
 * Admin Settings E2E Tests
 * Tests for Email Configuration and OAuth Provider tabs
 */
import { test, expect, skipIfNotAuthenticated } from "../fixtures/auth";

test.describe("Admin Settings (Authenticated)", () => {
  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("admin settings page loads with tabs", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/admin/settings");
    await authenticatedPage.waitForLoadState("networkidle");

    // Should not be redirected to login
    expect(authenticatedPage.url()).not.toContain("/login");

    // Verify page title
    await expect(authenticatedPage.locator("h1")).toContainText("Settings");

    // Verify tabs are present
    await expect(authenticatedPage.locator('[role="tablist"]')).toBeVisible();
    await expect(
      authenticatedPage.locator('button[role="tab"]:has-text("General")'),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator('button[role="tab"]:has-text("Email")'),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator(
        'button[role="tab"]:has-text("OAuth Providers")',
      ),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator('button[role="tab"]:has-text("Security")'),
    ).toBeVisible();
  });

  test("can navigate to Email tab", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/admin/settings");
    await authenticatedPage.waitForLoadState("networkidle");

    // Click Email tab
    await authenticatedPage.click('button[role="tab"]:has-text("Email")');

    // Wait for content to load
    await authenticatedPage.waitForTimeout(500);

    // Verify Email Configuration content is visible
    await expect(
      authenticatedPage.locator("text=Email Provider"),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator(
        "text=Choose how transactional emails are sent",
      ),
    ).toBeVisible();
  });

  test("email tab shows provider selection", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/admin/settings");
    await authenticatedPage.waitForLoadState("networkidle");

    // Click Email tab
    await authenticatedPage.click('button[role="tab"]:has-text("Email")');
    await authenticatedPage.waitForTimeout(500);

    // Verify provider dropdown exists
    await expect(
      authenticatedPage.locator('label:has-text("Provider")'),
    ).toBeVisible();
  });

  test("can navigate to OAuth Providers tab", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/admin/settings");
    await authenticatedPage.waitForLoadState("networkidle");

    // Click OAuth Providers tab
    await authenticatedPage.click(
      'button[role="tab"]:has-text("OAuth Providers")',
    );

    // Wait for content to load
    await authenticatedPage.waitForTimeout(500);

    // Verify OAuth Providers content is visible
    await expect(
      authenticatedPage.locator("text=OAuth Provider Configuration"),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator("text=Configure social login providers"),
    ).toBeVisible();
  });

  test("oauth tab shows provider list", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/admin/settings");
    await authenticatedPage.waitForLoadState("networkidle");

    // Click OAuth Providers tab
    await authenticatedPage.click(
      'button[role="tab"]:has-text("OAuth Providers")',
    );
    await authenticatedPage.waitForTimeout(500);

    // Verify providers are listed
    // Each name also appears in its card's description and callback URL.
    for (const provider of ["Google", "GitHub", "Microsoft", "Custom OIDC"]) {
      await expect(
        authenticatedPage.locator(`text=${provider}`).first(),
      ).toBeVisible();
    }
  });

  test("oauth tab shows callback URLs section", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/admin/settings");
    await authenticatedPage.waitForLoadState("networkidle");

    // Click OAuth Providers tab
    await authenticatedPage.click(
      'button[role="tab"]:has-text("OAuth Providers")',
    );
    await authenticatedPage.waitForTimeout(500);

    // Verify callback URLs section
    await expect(authenticatedPage.locator("text=Callback URLs")).toBeVisible();
    await expect(
      authenticatedPage.locator(
        "text=Use these URLs when configuring OAuth applications",
      ),
    ).toBeVisible();
  });

  test("can navigate to Security tab", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/admin/settings");
    await authenticatedPage.waitForLoadState("networkidle");

    // Click Security tab
    await authenticatedPage.click('button[role="tab"]:has-text("Security")');

    // Wait for content to load
    await authenticatedPage.waitForTimeout(500);

    // Verify Security content is visible
    await expect(
      authenticatedPage.getByText("IP Allowlist", { exact: true }),
    ).toBeVisible();
  });

  test("general tab shows expected settings", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/admin/settings");
    await authenticatedPage.waitForLoadState("networkidle");

    // General tab should be active by default
    await expect(
      authenticatedPage.locator(
        'button[role="tab"][data-state="active"]:has-text("General")',
      ),
    ).toBeVisible();

    // Verify general settings content
    await expect(
      authenticatedPage.getByText("Authentication", { exact: true }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText("Allow Sign-ups", { exact: true }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText("Session Timeout (hours)", { exact: true }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText("AI Configuration", { exact: true }),
    ).toBeVisible();
  });
});
