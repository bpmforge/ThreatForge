/**
 * API Endpoint Validation Tests
 *
 * Verifies API endpoints respond correctly:
 * - Correct HTTP status codes
 * - Proper error messages
 * - Authorization enforcement
 * - Input validation
 *
 * Run: npx playwright test api-validation.spec.ts
 */
import { test, expect, skipIfNotAuthenticated } from "../../fixtures/auth";

test.describe("API Health & Auth", () => {
  test.setTimeout(30000);

  test("API health endpoint responds", async ({ page }) => {
    const response = await page.request.get("/api/health");
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body).toHaveProperty("status");
  });

  test("protected endpoints require authentication", async ({ page }) => {
    // Clear cookies to ensure unauthenticated
    await page.context().clearCookies();

    const protectedEndpoints = [
      "/api/organizations",
      "/api/projects",
      "/api/threat-models",
    ];

    for (const endpoint of protectedEndpoints) {
      const response = await page.request.get(endpoint);
      // Should return 401 Unauthorized
      expect([401, 403]).toContain(response.status());
    }
  });
});

test.describe("API Response Format Consistency", () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("organizations endpoint returns proper format", async ({
    authenticatedPage,
  }) => {
    const response = await authenticatedPage.request.get("/api/organizations");

    if (response.ok()) {
      const body = await response.json();
      // Should be an array or have data property
      expect(Array.isArray(body) || Array.isArray(body.data)).toBe(true);
    } else {
      // Error response should have error property
      const body = await response.json();
      expect(body).toHaveProperty("error");
    }
  });

  test("projects endpoint returns proper format", async ({
    authenticatedPage,
  }) => {
    const response = await authenticatedPage.request.get("/api/projects");

    if (response.ok()) {
      const body = await response.json();
      expect(Array.isArray(body) || body.data).toBeTruthy();
    }
  });

  test("threat-models endpoint returns proper format", async ({
    authenticatedPage,
  }) => {
    const response = await authenticatedPage.request.get("/api/threat-models");

    if (response.ok()) {
      const body = await response.json();
      expect(Array.isArray(body) || body.data).toBeTruthy();
    }
  });
});

test.describe("API Input Validation", () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("project creation validates name length", async ({
    authenticatedPage,
  }) => {
    // Try to create project with empty name
    const response = await authenticatedPage.request.post("/api/projects", {
      data: { name: "" },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error || body.message).toBeTruthy();
  });

  test("project creation validates name minimum length", async ({
    authenticatedPage,
  }) => {
    // Try to create project with too short name
    const response = await authenticatedPage.request.post("/api/projects", {
      data: { name: "ab" },
    });

    // Should fail validation (name must be >= 3 chars)
    expect(response.status()).toBe(400);
  });

  test("threat creation requires strideCategories", async ({
    authenticatedPage,
  }) => {
    // First get a threat model ID
    const modelsResponse =
      await authenticatedPage.request.get("/api/threat-models");
    if (!modelsResponse.ok()) return;

    const models = await modelsResponse.json();
    const modelId = Array.isArray(models)
      ? models[0]?.id
      : models.data?.[0]?.id;

    if (!modelId) return;

    // Try to create threat without strideCategories
    const response = await authenticatedPage.request.post(
      `/api/threat-models/${modelId}/threats`,
      {
        data: {
          name: "Test Threat",
          severity: "HIGH",
          // Missing strideCategories
        },
      },
    );

    expect(response.status()).toBe(400);
  });

  test("threat creation validates severity enum", async ({
    authenticatedPage,
  }) => {
    const modelsResponse =
      await authenticatedPage.request.get("/api/threat-models");
    if (!modelsResponse.ok()) return;

    const models = await modelsResponse.json();
    const modelId = Array.isArray(models)
      ? models[0]?.id
      : models.data?.[0]?.id;

    if (!modelId) return;

    // Try to create threat with invalid severity
    const response = await authenticatedPage.request.post(
      `/api/threat-models/${modelId}/threats`,
      {
        data: {
          name: "Test Threat",
          strideCategories: ["SPOOFING"],
          severity: "INVALID_SEVERITY", // Should fail
        },
      },
    );

    expect(response.status()).toBe(400);
  });
});

test.describe("API Authorization", () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("cannot access non-existent resources", async ({
    authenticatedPage,
  }) => {
    // Try to access non-existent threat model
    const response = await authenticatedPage.request.get(
      "/api/threat-models/non-existent-id-12345",
    );

    // Should return 404 Not Found
    expect(response.status()).toBe(404);
  });

  test("cannot delete non-existent project", async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.delete(
      "/api/projects/non-existent-id-12345",
    );

    // Should return 404 Not Found
    expect(response.status()).toBe(404);
  });
});

test.describe("API Edge Cases", () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
  });

  test("handles empty request body gracefully", async ({
    authenticatedPage,
  }) => {
    const response = await authenticatedPage.request.post("/api/projects", {
      data: {},
    });

    // Should return validation error, not 500
    expect(response.status()).toBeLessThan(500);
  });

  test("handles malformed JSON gracefully", async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.post("/api/projects", {
      headers: { "Content-Type": "application/json" },
      data: "not valid json{",
    });

    // Should return 400 Bad Request, not 500
    expect(response.status()).toBeLessThan(500);
  });

  test("handles very long input gracefully", async ({ authenticatedPage }) => {
    const veryLongName = "a".repeat(10000);

    const response = await authenticatedPage.request.post("/api/projects", {
      data: { name: veryLongName },
    });

    // Should return validation error for length
    expect(response.status()).toBe(400);
  });
});
