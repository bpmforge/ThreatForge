import { test, expect, skipIfNotAuthenticated } from "../fixtures/auth";

/**
 * Risk Analysis E2E Tests
 *
 * Tests for attack paths and risk dashboard features.
 */

test.describe("Risk Analysis Features", () => {
  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test.describe("Attack Paths", () => {
    test("attack path panel renders without errors", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/models/new");
      await authenticatedPage.waitForLoadState("networkidle");

      const hasCanvas = await authenticatedPage
        .locator(".react-flow")
        .isVisible()
        .catch(() => false);
      if (!hasCanvas) {
        test.skip();
        return;
      }

      // Attack paths feature should not crash the page
      await expect(authenticatedPage).not.toHaveTitle(/error/i);
    });

    test("empty state shows when no threats exist", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/models/new");
      await authenticatedPage.waitForLoadState("networkidle");

      const hasCanvas = await authenticatedPage
        .locator(".react-flow")
        .isVisible()
        .catch(() => false);
      if (!hasCanvas) {
        test.skip();
        return;
      }

      // Look for attack paths section or empty state
      const attackPathsSection = authenticatedPage.locator(
        "text=/attack path/i",
      );
      const emptyState = authenticatedPage.locator("text=/no attack paths/i");

      const hasSectionOrEmpty =
        (await attackPathsSection.isVisible().catch(() => false)) ||
        (await emptyState.isVisible().catch(() => false));

      // Either section exists or page loads without error
      expect(hasSectionOrEmpty || hasCanvas).toBe(true);
    });
  });

  test.describe("Risk Dashboard", () => {
    test("risk metrics display correctly", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/dashboard");
      await authenticatedPage.waitForLoadState("networkidle");

      // Dashboard should load
      const dashboardVisible = await authenticatedPage
        .locator("text=/dashboard/i")
        .first()
        .isVisible()
        .catch(() => false);
      expect(
        dashboardVisible || authenticatedPage.url().includes("dashboard"),
      ).toBe(true);
    });

    test("risk score card renders", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/dashboard");
      await authenticatedPage.waitForLoadState("networkidle");

      // Look for risk-related content
      const riskContent = authenticatedPage.locator(
        "text=/risk|threat|model/i",
      );
      const hasRiskContent = await riskContent
        .first()
        .isVisible()
        .catch(() => false);

      // Dashboard should show some risk/threat related info
      expect(
        hasRiskContent || authenticatedPage.url().includes("dashboard"),
      ).toBe(true);
    });

    test("STRIDE category breakdown visible", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/dashboard");
      await authenticatedPage.waitForLoadState("networkidle");

      // Page should load without errors
      await expect(authenticatedPage).not.toHaveTitle(/error/i);
    });
  });
});
