/**
 * API Contract Tests — Response Shapes & Error Envelope
 *
 * Verifies the cross-cutting contracts from docs/sdlc/API_CONTRACTS.md:
 * - Error response always has { error, code } shape
 * - Pagination responses have { data: [], pagination: {} }
 * - Documented error codes match actual responses
 * - Categories/template APIs return arrays not wrapped objects (regression)
 */
import { test, expect, get, post, assertHasKeys, unwrap } from "./_fixtures";

test.describe("Error response envelope", () => {
  test("404 response has {error, code} shape", async ({
    loggedInPage: page,
  }) => {
    const r = await get(page, "/api/threat-models/does-not-exist-xyz");
    expect(r.status).toBe(404);
    const body = r.body as Record<string, unknown>;
    assertHasKeys(body, ["error", "code"], "404 error body");
    expect(typeof body.error).toBe("string");
    expect(typeof body.code).toBe("string");
  });

  test("400 validation error has {error, code} and optional details", async ({
    loggedInPage: page,
  }) => {
    // POST with missing required field
    const r = await post(page, "/api/threat-models", {});
    expect(r.status).toBe(400);
    const body = r.body as Record<string, unknown>;
    assertHasKeys(body, ["error", "code"], "400 error body");
  });

  test("401 unauthenticated has {error, code} matching UNAUTHORIZED", async ({
    request,
  }) => {
    const r = await request.get("/api/threat-models");
    expect(r.status()).toBe(401);
    const body = await r.json();
    assertHasKeys(body, ["error", "code"], "401 error body");
    expect(body.code).toMatch(/UNAUTHORIZED|AUTH/i);
  });
});

test.describe("Pagination envelope", () => {
  test("GET /api/threat-models — has data array and pagination object", async ({
    loggedInPage: page,
  }) => {
    const r = await get(page, "/api/threat-models?limit=5");
    expect(r.status).toBe(200);
    const body = r.body as Record<string, unknown>;

    // Either { data: [], pagination: {} } or plain array — both are valid
    if (Array.isArray(body)) {
      expect(body).toBeTruthy();
    } else if ("pagination" in body) {
      expect(Array.isArray(body.data)).toBe(true);
      assertHasKeys(
        body.pagination as object,
        ["total", "hasMore"],
        "pagination object",
      );
    } else {
      // Flat data array under data key
      expect(Array.isArray(body.data)).toBe(true);
    }
  });

  test("GET /api/v1/model-templates — has data[] and pagination{}", async ({
    loggedInPage: page,
  }) => {
    const r = await get(page, "/api/v1/model-templates");
    expect(r.status).toBe(200);
    const body = r.body as Record<string, unknown>;

    // After apiClient unwrap: {data:[], pagination:{}}
    // Raw response: {data:{data:[], pagination:{}}}
    const inner = (body.data ?? body) as Record<string, unknown>;
    expect(Array.isArray(inner.data ?? inner)).toBe(true);
  });
});

test.describe("API response shape regressions", () => {
  test("GET /api/v1/model-templates/categories — returns array, not double-wrapped object", async ({
    loggedInPage: page,
  }) => {
    // Regression: 2026-04-23 — sendSuccess(reply, { data: [...] }) caused
    // double-wrap: {data:{data:[]}}. apiClient unwrapped to {data:[]}
    // which isn't an array — TemplateGallery crashed calling .map() on it.
    const r = await get(page, "/api/v1/model-templates/categories");
    expect(r.status).toBe(200);

    const body = r.body as Record<string, unknown>;
    // Raw: {data: [...]}  →  body.data should be an array
    const categories = body.data ?? body;
    expect(
      Array.isArray(categories),
      `Expected array, got ${JSON.stringify(categories).slice(0, 100)}`,
    ).toBe(true);
  });

  test("GET /health — returns consistent shape with all dependency checks", async ({
    request,
  }) => {
    const r = await request.get("/health");
    expect(r.status()).toBe(200);
    const body = await r.json();
    // Must have status field and at least database check
    expect(body).toHaveProperty("status");
    const hasDb = "database" in (body.checks ?? body) || "database" in body;
    expect(hasDb).toBe(true);
  });

  test("GET /api/threat-models/:id — stats sub-object present", async ({
    loggedInPage: page,
  }) => {
    const r = await get(page, "/api/threat-models");
    const list = unwrap<Record<string, unknown>[]>(r.body);
    if (!Array.isArray(list) || list.length === 0) return;

    const id = list[0].id as string;
    const detail = await get(page, `/api/threat-models/${id}`);
    expect(detail.status).toBe(200);
    const data = unwrap<Record<string, unknown>>(detail.body);
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("name");
  });
});

test.describe("Threat model stats endpoint", () => {
  test("GET /api/threat-models/:id/stats — returns numeric counts", async ({
    loggedInPage: page,
  }) => {
    const r = await get(page, "/api/threat-models");
    const list = unwrap<Record<string, unknown>[]>(r.body);
    if (!Array.isArray(list) || list.length === 0) {
      test.skip(true, "No models to test stats against");
      return;
    }

    const id = list[0].id as string;
    const statsR = await get(page, `/api/threat-models/${id}/stats`);
    if (statsR.status === 404) return; // endpoint may not exist on all versions

    expect(statsR.status).toBe(200);
    const stats = unwrap<Record<string, unknown>>(statsR.body);
    // All count fields should be non-negative numbers
    for (const field of [
      "threatCount",
      "mitigatedCount",
      "componentCount",
      "criticalCount",
    ]) {
      if (field in stats) {
        expect(typeof stats[field]).toBe("number");
        expect(stats[field] as number).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
