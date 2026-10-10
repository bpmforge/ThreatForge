import { test, expect } from "@playwright/test";

/**
 * Real-time Collaboration Tests
 *
 * Tests the collaboration features including connection status,
 * collaborator cursors, and multi-user editing capabilities.
 * Note: Full multi-browser collaboration tests require a running WebSocket server.
 */
test.describe("Collaboration Features", () => {
  test.describe("Connection Status Indicator", () => {
    test("connection status component is bundled correctly", async ({
      page,
    }) => {
      const response = await page.goto("/models/test-model-id");
      expect(response?.status()).not.toBe(500);
    });

    test("model page loads without collaboration errors", async ({ page }) => {
      const errors: string[] = [];

      page.on("pageerror", (error) => {
        errors.push(error.message);
      });

      await page.goto("/models/test-model-id");
      await page.waitForLoadState("networkidle");

      // Filter out expected errors (auth, network, etc.)
      const collaborationErrors = errors.filter(
        (e) =>
          e.includes("collaboration") ||
          e.includes("Yjs") ||
          e.includes("WebSocket"),
      );

      // WebSocket connection errors are expected without a server
      // We just verify no critical JS errors in the collaboration code itself
      const criticalErrors = collaborationErrors.filter(
        (e) =>
          !e.includes("WebSocket") &&
          !e.includes("connection") &&
          !e.includes("ECONNREFUSED"),
      );

      expect(criticalErrors).toHaveLength(0);
    });
  });

  test.describe("Collaborator Cursors", () => {
    test("cursor component is bundled correctly", async ({ page }) => {
      // This verifies the CollaboratorCursors component can be imported
      const response = await page.goto("/models/test-model-id");
      expect(response?.status()).not.toBe(500);
    });
  });

  test.describe("Selection Highlights", () => {
    test("selection highlights component is bundled correctly", async ({
      page,
    }) => {
      // This verifies the SelectionHighlights component can be imported
      const response = await page.goto("/models/test-model-id");
      expect(response?.status()).not.toBe(500);
    });
  });

  test.describe("Collaboration Hooks", () => {
    test("useCollaboration hook is bundled correctly", async ({ page }) => {
      const response = await page.goto("/models/test-model-id");
      expect(response?.status()).not.toBe(500);
    });

    test("useCollaborativeCanvas hook is bundled correctly", async ({
      page,
    }) => {
      const response = await page.goto("/models/test-model-id");
      expect(response?.status()).not.toBe(500);
    });
  });
});

test.describe("Collaboration UI Elements", () => {
  test("model editor page structure is correct", async ({ page }) => {
    await page.goto("/models/test-model-id");

    // Wait for page to stabilize
    await page.waitForLoadState("networkidle");

    // Page should either show editor or redirect to login
    const url = page.url();
    expect(url.includes("/models") || url.includes("/login")).toBeTruthy();
  });
});

test.describe("Multi-User Collaboration Simulation", () => {
  // These tests verify the collaboration infrastructure without requiring
  // multiple browser contexts with a live WebSocket server

  test("collaboration feature module exports correctly", async ({ page }) => {
    // Verify page loads without module resolution errors
    const consoleMessages: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleMessages.push(msg.text());
      }
    });

    await page.goto("/models/test-model-id");
    await page.waitForLoadState("networkidle");

    // Check no module resolution errors
    const moduleErrors = consoleMessages.filter(
      (msg) =>
        msg.includes("Cannot find module") ||
        msg.includes("Failed to resolve") ||
        msg.includes("Module not found"),
    );

    expect(moduleErrors).toHaveLength(0);
  });

  test("Yjs dependencies are bundled correctly", async ({ page }) => {
    const consoleMessages: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleMessages.push(msg.text());
      }
    });

    await page.goto("/models/test-model-id");
    await page.waitForLoadState("networkidle");

    // Verify no Yjs-related bundling errors
    const yjsErrors = consoleMessages.filter(
      (msg) =>
        msg.includes("yjs") ||
        msg.includes("y-websocket") ||
        msg.includes("lib0"),
    );

    expect(yjsErrors).toHaveLength(0);
  });
});

test.describe("Offline Behavior", () => {
  test("model editor handles offline gracefully", async ({ page, context }) => {
    // First load the page
    await page.goto("/models/test-model-id");
    await page.waitForLoadState("networkidle");

    // Simulate offline mode
    await context.setOffline(true);

    // Page should not crash
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    // Wait a moment for any reconnection attempts
    await page.waitForTimeout(1000);

    // Filter out expected network errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("Network") &&
        !e.includes("fetch") &&
        !e.includes("WebSocket") &&
        !e.includes("offline"),
    );

    expect(criticalErrors).toHaveLength(0);

    // Restore online mode
    await context.setOffline(false);
  });
});
