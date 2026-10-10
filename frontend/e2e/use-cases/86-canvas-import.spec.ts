/**
 * UC-86: Canvas JSON import (US-12.3)
 *
 * Tests POST /api/threat-models/import — imports a raw React Flow canvas
 * state JSON as a new threat model.
 */
import { test, expect, login, deleteModel, apiPost, apiGet } from "./_fixtures";

const CANVAS_FIXTURE = {
  nodes: [
    {
      id: "n1",
      type: "component",
      position: { x: 100, y: 100 },
      data: {
        label: "Customer Browser",
        type: "ACTOR",
        trustLevel: "EXTERNAL",
      },
    },
    {
      id: "n2",
      type: "component",
      position: { x: 400, y: 100 },
      data: {
        label: "Web App",
        type: "WEB_APP",
        trustLevel: "INTERNAL",
      },
    },
    {
      id: "n3",
      type: "component",
      position: { x: 700, y: 100 },
      data: {
        label: "Orders DB",
        type: "DATABASE",
        trustLevel: "CONFIDENTIAL",
      },
    },
  ],
  edges: [
    {
      id: "e1",
      source: "n1",
      target: "n2",
      label: "HTTPS",
      data: { protocol: "HTTPS" },
    },
    {
      id: "e2",
      source: "n2",
      target: "n3",
      label: "SQL",
      data: { protocol: "SQL" },
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

test.describe("UC-86 — Canvas JSON Import", () => {
  const createdModelIds: string[] = [];

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    for (const id of createdModelIds) {
      await deleteModel(page, id).catch(() => {});
    }
    await page.close();
  });

  test("US-12.3: POST /import accepts canvas JSON and creates a model", async ({
    page,
  }) => {
    await login(page);

    const res = await apiPost<{ id?: string; name?: string }>(
      page,
      "/api/threat-models/import",
      {
        name: "E2E Canvas Import",
        canvasState: CANVAS_FIXTURE,
      },
    );

    expect(res.id).toBeTruthy();
    if (res.id) createdModelIds.push(res.id);
  });

  test("US-12.3: Imported canvas model has the correct nodes", async ({
    page,
  }) => {
    await login(page);

    const res = await apiPost<{ id?: string }>(
      page,
      "/api/threat-models/import",
      {
        name: "E2E Canvas Node Check",
        canvasState: CANVAS_FIXTURE,
      },
    );
    if (!res.id) {
      test.skip();
      return;
    }
    createdModelIds.push(res.id);

    const model = await apiGet<{ id: string; canvasState?: string }>(
      page,
      `/api/threat-models/${res.id}`,
    );
    expect(model.id).toBe(res.id);

    const canvas =
      typeof model.canvasState === "string"
        ? JSON.parse(model.canvasState)
        : (model.canvasState ?? {});
    expect(canvas.nodes?.length).toBe(CANVAS_FIXTURE.nodes.length);
    expect(canvas.edges?.length).toBe(CANVAS_FIXTURE.edges.length);
  });

  test("US-12.3: Imported canvas preserves component labels", async ({
    page,
  }) => {
    await login(page);

    const res = await apiPost<{ id?: string }>(
      page,
      "/api/threat-models/import",
      {
        name: "E2E Canvas Label Check",
        canvasState: CANVAS_FIXTURE,
      },
    );
    if (!res.id) {
      test.skip();
      return;
    }
    createdModelIds.push(res.id);

    const model = await apiGet<{ canvasState?: string }>(
      page,
      `/api/threat-models/${res.id}`,
    );
    const canvas =
      typeof model.canvasState === "string"
        ? JSON.parse(model.canvasState)
        : (model.canvasState ?? {});
    const labels = (canvas.nodes as Array<{ data?: { label?: string } }>).map(
      (n) => n.data?.label ?? "",
    );

    expect(labels).toContain("Customer Browser");
    expect(labels).toContain("Web App");
    expect(labels).toContain("Orders DB");
  });

  test("US-12.3: POST /import rejects malformed canvas JSON", async ({
    page,
  }) => {
    await login(page);

    const caught = await apiPost(page, "/api/threat-models/import", {
      name: "Bad Import",
      canvasState: "this is not json {{{",
    }).catch((e: Error) => ({ error: e.message }));

    expect((caught as { error?: string }).error).toBeTruthy();
  });

  test("US-12.3: Imported model appears in the model list", async ({
    page,
  }) => {
    await login(page);

    const res = await apiPost<{ id?: string }>(
      page,
      "/api/threat-models/import",
      {
        name: "E2E Canvas List Check",
        canvasState: CANVAS_FIXTURE,
      },
    );
    if (!res.id) {
      test.skip();
      return;
    }
    createdModelIds.push(res.id);

    const list = await apiGet<
      { data?: Array<{ id: string }> } | Array<{ id: string }>
    >(page, "/api/threat-models");
    const arr = Array.isArray(list)
      ? list
      : ((list as { data?: Array<{ id: string }> }).data ?? []);
    expect(arr.find((m) => m.id === res.id)).toBeTruthy();
  });
});
