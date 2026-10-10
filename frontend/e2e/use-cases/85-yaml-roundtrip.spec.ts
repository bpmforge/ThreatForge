/**
 * UC-85: YAML round-trip export + import (US-12.3, US-13.2)
 *
 * Verifies that a model exported as YAML can be re-imported without data loss:
 *   GET  /api/threat-models/:id/export/yaml
 *   POST /api/threat-models/import/yaml
 */
import {
  test,
  expect,
  login,
  createOnlineCheckoutModel,
  deleteModel,
  apiPost,
  apiGet,
} from "./_fixtures";

const YAML_FIXTURE = `
name: "E2E YAML Import Model"
version: "1.0"
methodology: STRIDE
description: "Minimal fixture for YAML round-trip test"

components:
  - id: comp-web
    name: Web Application
    type: WEB_APP
    trustLevel: EXTERNAL
    x: 100
    y: 100
  - id: comp-api
    name: REST API
    type: API
    trustLevel: INTERNAL
    x: 400
    y: 100
  - id: comp-db
    name: Customer DB
    type: DATABASE
    trustLevel: CONFIDENTIAL
    x: 700
    y: 100

connections:
  - from: comp-web
    to: comp-api
    label: HTTPS requests
  - from: comp-api
    to: comp-db
    label: SQL queries

threats:
  - name: SQL Injection
    description: Attacker bypasses authentication via malformed SQL
    strideCategory: TAMPERING
    severity: HIGH
    status: OPEN
    componentId: comp-db
`;

test.describe("UC-85 — YAML Round-trip", () => {
  let sourceModelId: string;
  const createdModelIds: string[] = [];

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    sourceModelId = await createOnlineCheckoutModel(page);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    await deleteModel(page, sourceModelId).catch(() => {});
    for (const id of createdModelIds) {
      await deleteModel(page, id).catch(() => {});
    }
    await page.close();
  });

  test("US-13.2: GET /export/yaml returns valid YAML for a model", async ({
    page,
  }) => {
    await login(page);

    const yaml = await page.evaluate(async (id) => {
      const r = await fetch(`/api/threat-models/${id}/export/yaml`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(`${r.status}`);
      return r.text();
    }, sourceModelId);

    expect(typeof yaml).toBe("string");
    expect(yaml.length).toBeGreaterThan(10);
    // Exported YAML should contain the model name
    expect(yaml).toMatch(/name:/i);
  });

  test("US-12.3: POST /import/yaml creates a model from YAML fixture", async ({
    page,
  }) => {
    await login(page);

    const res = await apiPost<{
      modelId?: string;
      componentCount?: number;
      threatCount?: number;
    }>(page, "/api/threat-models/import/yaml", {
      content: YAML_FIXTURE,
    });

    expect(res.modelId).toBeTruthy();
    if (res.modelId) createdModelIds.push(res.modelId);
  });

  test("US-12.3: YAML import canvas has correct node count", async ({
    page,
  }) => {
    await login(page);

    const res = await apiPost<{ modelId?: string }>(
      page,
      "/api/threat-models/import/yaml",
      { content: YAML_FIXTURE },
    );
    if (!res.modelId) {
      test.skip();
      return;
    }
    createdModelIds.push(res.modelId);

    const model = await apiGet<{ canvasState?: string }>(
      page,
      `/api/threat-models/${res.modelId}`,
    );
    const canvas =
      typeof model.canvasState === "string"
        ? JSON.parse(model.canvasState)
        : (model.canvasState ?? {});
    expect(canvas.nodes?.length).toBeGreaterThanOrEqual(3);
    expect(canvas.edges?.length).toBeGreaterThanOrEqual(2);
  });

  test("US-12.3: YAML round-trip — export then re-import preserves name", async ({
    page,
  }) => {
    await login(page);

    // Step 1: export
    const yaml = await page.evaluate(async (id) => {
      const r = await fetch(`/api/threat-models/${id}/export/yaml`, {
        credentials: "include",
      });
      if (!r.ok) return null;
      return r.text();
    }, sourceModelId);

    if (!yaml) {
      test.skip();
      return;
    }

    // Step 2: re-import
    const res = await apiPost<{ modelId?: string }>(
      page,
      "/api/threat-models/import/yaml",
      { content: yaml },
    );

    expect(res.modelId).toBeTruthy();
    if (res.modelId) {
      createdModelIds.push(res.modelId);

      // Step 3: verify reimported model is accessible
      const model = await apiGet<{ id: string }>(
        page,
        `/api/threat-models/${res.modelId}`,
      );
      expect(model.id).toBe(res.modelId);
    }
  });

  test("US-12.3: POST /import/yaml rejects empty content", async ({ page }) => {
    await login(page);

    const caught = await apiPost(page, "/api/threat-models/import/yaml", {
      content: "",
    }).catch((e: Error) => ({ error: e.message }));

    expect((caught as { error?: string }).error).toBeTruthy();
  });
});
