/**
 * API Contract Tests — Threat Models
 *
 * Verifies the documented contracts in docs/sdlc/API_CONTRACTS.md:
 * - Response shapes match the spec
 * - Auth enforcement (401/403)
 * - Error response shape is consistent
 * - save-canvas uses updateMany path without P2025 errors
 */
import {
  test,
  expect,
  get,
  post,
  patch,
  del,
  createTempModel,
  deleteTempModel,
  assertHasKeys,
  unwrap,
} from "./_fixtures";

test.describe("Threat Models — CRUD contracts", () => {
  test("GET /api/threat-models — returns paginated list with correct shape", async ({
    loggedInPage: page,
  }) => {
    const r = await get(page, "/api/threat-models");
    expect(r.status).toBe(200);

    const body = r.body as Record<string, unknown>;
    // Can be { data: [], pagination: {} } or just []
    const list = Array.isArray(body) ? body : (body.data ?? body);
    expect(Array.isArray(list)).toBe(true);

    if ((list as unknown[]).length > 0) {
      const first = (list as Record<string, unknown>[])[0];
      assertHasKeys(first, ["id", "name"], "model list item");
    }
  });

  test("POST /api/threat-models — creates model, returns 201 with id and name", async ({
    loggedInPage: page,
  }) => {
    const name = `contract-create-${Date.now()}`;
    const r = await post(page, "/api/threat-models", { name });
    expect(r.status).toBe(201);

    const data = unwrap<Record<string, unknown>>(r.body);
    assertHasKeys(data, ["id", "name"], "created model");
    expect(data.name).toBe(name);

    await deleteTempModel(page, data.id as string);
  });

  test("GET /api/threat-models/:id — returns full model with stats", async ({
    loggedInPage: page,
  }) => {
    const id = await createTempModel(page);

    const r = await get(page, `/api/threat-models/${id}`);
    expect(r.status).toBe(200);

    const data = unwrap<Record<string, unknown>>(r.body);
    assertHasKeys(
      data,
      ["id", "name", "methodology", "status"],
      "model detail",
    );

    await deleteTempModel(page, id);
  });

  test("GET /api/threat-models/:id — returns 404 for nonexistent id", async ({
    loggedInPage: page,
  }) => {
    const r = await get(page, "/api/threat-models/nonexistent-id-xyz");
    expect(r.status).toBe(404);

    const body = r.body as Record<string, unknown>;
    assertHasKeys(body, ["error", "code"], "404 error shape");
  });

  test("PATCH /api/threat-models/:id — updates name, returns updated model", async ({
    loggedInPage: page,
  }) => {
    const id = await createTempModel(page);
    const newName = `contract-updated-${Date.now()}`;

    const r = await patch(page, `/api/threat-models/${id}`, { name: newName });
    expect(r.status).toBe(200);

    const data = unwrap<Record<string, unknown>>(r.body);
    expect(data.name).toBe(newName);

    await deleteTempModel(page, id);
  });

  test("DELETE /api/threat-models/:id — returns 204", async ({
    loggedInPage: page,
  }) => {
    const id = await createTempModel(page);
    const r = await del(page, `/api/threat-models/${id}`);
    expect(r.status).toBe(204);

    // Confirm gone
    const check = await get(page, `/api/threat-models/${id}`);
    expect(check.status).toBe(404);
  });
});

test.describe("Threat Models — save-canvas contract", () => {
  test("POST /api/threat-models/:id/save-canvas — persists nodes and returns success", async ({
    loggedInPage: page,
  }) => {
    const id = await createTempModel(page);

    const r = await post(page, `/api/threat-models/${id}/save-canvas`, {
      nodes: [
        {
          id: "n1",
          type: "component",
          position: { x: 100, y: 100 },
          data: { label: "Web App", type: "WEB_APP", trustLevel: "PUBLIC" },
        },
        {
          id: "n2",
          type: "component",
          position: { x: 400, y: 100 },
          data: {
            label: "Database",
            type: "DATA_STORE",
            trustLevel: "RESTRICTED",
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "n1",
          target: "n2",
          type: "security",
          data: { protocol: "HTTPS", encrypted: true, authenticated: true },
        },
      ],
    });

    expect(r.status).toBe(200);
    const data = unwrap<Record<string, unknown>>(r.body);
    expect(data.success).toBe(true);

    // Verify components were synced to DB
    const statsR = await get(page, `/api/threat-models/${id}/stats`);
    if (statsR.status === 200) {
      const stats = unwrap<Record<string, unknown>>(statsR.body);
      // componentCount should reflect the 2 nodes we saved
      expect(
        Number(stats.componentCount ?? stats.components ?? 0),
      ).toBeGreaterThanOrEqual(2);
    }

    await deleteTempModel(page, id);
  });

  test("POST /api/threat-models/:id/save-canvas — concurrent delete race returns 404 not 500", async ({
    loggedInPage: page,
  }) => {
    // Verifies the updateMany fix: deleting a model while a save is in-flight
    // should return 404 (count=0 from updateMany) not P2025 (500 from update).
    const id = await createTempModel(page);
    await del(page, `/api/threat-models/${id}`);

    const r = await post(page, `/api/threat-models/${id}/save-canvas`, {
      nodes: [],
      edges: [],
    });
    // Should be 404 (model gone) not 500 (P2025 uncaught)
    expect(r.status).toBe(404);
    expect(r.status).not.toBe(500);
  });

  test("POST /api/threat-models/:id/save-canvas — invalid body returns 400", async ({
    loggedInPage: page,
  }) => {
    const id = await createTempModel(page);

    const r = await post(page, `/api/threat-models/${id}/save-canvas`, {
      invalid: "payload",
    });
    expect(r.status).toBe(400);

    const body = r.body as Record<string, unknown>;
    assertHasKeys(body, ["error"], "400 shape");

    await deleteTempModel(page, id);
  });
});

test.describe("Threat Models — auth enforcement", () => {
  test("GET /api/threat-models — unauthenticated returns 401", async ({
    request,
  }) => {
    const r = await request.get("/api/threat-models");
    expect(r.status()).toBe(401);
    const body = await r.json();
    assertHasKeys(body, ["error", "code"], "401 shape");
    expect(body.code).toMatch(/UNAUTHORIZED|AUTH/i);
  });

  test("POST /api/threat-models — unauthenticated returns 401", async ({
    request,
  }) => {
    const r = await request.post("/api/threat-models", {
      data: { name: "should-fail" },
    });
    expect(r.status()).toBe(401);
  });
});

test.describe("Threat Models — version history contracts", () => {
  test("POST /api/threat-models/:id/versions — creates snapshot, GET lists it", async ({
    loggedInPage: page,
  }) => {
    const id = await createTempModel(page);

    // Save a canvas first so there's something to snapshot
    await post(page, `/api/threat-models/${id}/save-canvas`, {
      nodes: [
        {
          id: "n1",
          type: "component",
          position: { x: 0, y: 0 },
          data: { label: "API", type: "API", trustLevel: "INTERNAL" },
        },
      ],
      edges: [],
    });

    // Create snapshot
    const createR = await post(page, `/api/threat-models/${id}/versions`, {
      name: "v1 — initial",
      changesSummary: "First snapshot for contract test",
    });
    expect(createR.status).toBe(201);

    const created = unwrap<Record<string, unknown>>(createR.body);
    assertHasKeys(
      created,
      ["id", "version", "name", "changesSummary", "createdAt"],
      "created version",
    );
    expect(created.version).toBeGreaterThanOrEqual(1);

    // List versions
    const listR = await get(page, `/api/threat-models/${id}/versions`);
    expect(listR.status).toBe(200);
    const versions = unwrap<unknown[]>(listR.body);
    expect(Array.isArray(versions)).toBe(true);
    expect((versions as unknown[]).length).toBeGreaterThanOrEqual(1);

    await deleteTempModel(page, id);
  });
});
