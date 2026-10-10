/**
 * UC-83: External threat model tool import (US-12.3)
 *
 * Tests POST /api/threat-models/import/tool for three supported formats:
 *   - Microsoft Threat Modeling Tool (.tm7 XML)
 *   - OWASP Threat Dragon (.json)
 *   - Threagile (.yaml)
 *
 * Also verifies graceful rejection of unknown/unsupported content.
 * The endpoint auto-detects format from content or filename extension.
 */
import { test, expect, login, deleteModel, apiPost, apiGet } from "./_fixtures";

// ── Minimal Microsoft TMT fixture ─────────────────────────────────────────────
const TMT_XML = `<?xml version="1.0"?>
<ThreatModel>
  <Name>E2E TMT Import</Name>
  <Boundaries/>
  <Elements>
    <Element>
      <Id>elem-001</Id>
      <Name>Web Frontend</Name>
      <GenericTypeId>tm.Store</GenericTypeId>
    </Element>
    <Element>
      <Id>elem-002</Id>
      <Name>API Gateway</Name>
      <GenericTypeId>tm.Process</GenericTypeId>
    </Element>
  </Elements>
  <Flows>
    <Flow>
      <Name>HTTP Request</Name>
      <SourceGuid>elem-001</SourceGuid>
      <TargetGuid>elem-002</TargetGuid>
    </Flow>
  </Flows>
  <Threats>
    <Threat>
      <Title>SQL Injection via API</Title>
      <Category>TAMPERING</Category>
      <Priority>High</Priority>
      <Description>Attacker injects SQL via the API endpoint</Description>
    </Threat>
  </Threats>
</ThreatModel>`;

// ── Minimal OWASP Threat Dragon fixture ───────────────────────────────────────
const DRAGON_JSON = JSON.stringify({
  summary: { title: "E2E Dragon Import" },
  detail: {
    diagrams: [
      {
        cells: [
          {
            type: "tm.Process",
            id: "d-001",
            attrs: { text: { text: "User Browser" } },
            position: { x: 100, y: 100 },
          },
          {
            type: "tm.Store",
            id: "d-002",
            attrs: { text: { text: "Database" } },
            position: { x: 400, y: 100 },
          },
          {
            type: "tm.Flow",
            id: "d-flow-1",
            attrs: { text: { text: "Query" } },
            source: { id: "d-001" },
            target: { id: "d-002" },
            threats: [
              {
                title: "Data exposure over unencrypted channel",
                type: "Information Disclosure",
                severity: "High",
                description: "Data transmitted without TLS",
              },
            ],
          },
        ],
      },
    ],
  },
});

// ── Minimal Threagile fixture ──────────────────────────────────────────────────
const THREAGILE_YAML = `threagile_version: "1.0.0"
title: E2E Threagile Import
author:
  name: E2E Test

technical_assets:
  frontend:
    id: frontend
    title: Frontend App
    type: process
    technologies:
      - Web Application
    trust_boundary_id: internet
  backend:
    id: backend
    title: Backend API
    type: process
    technologies:
      - REST API
    trust_boundary_id: dmz

trust_boundaries:
  internet:
    id: internet
    title: Internet
    type: network-cloud-provider
    technical_assets_inside:
      - frontend
  dmz:
    id: dmz
    title: DMZ
    type: network-on-prem
    technical_assets_inside:
      - backend

data_assets:
  user-data:
    id: user-data
    title: User Data
    usage: business
    origin: user

communication_links:
  frontend-to-backend:
    source: frontend
    target: backend
    title: HTTPS API calls
    authentication: none
    authorization: none
    protocol: https
    data_assets_sent:
      - user-data
`;

test.describe("UC-83 — External Tool Import", () => {
  const createdModelIds: string[] = [];

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    for (const id of createdModelIds) {
      await deleteModel(page, id).catch(() => {});
    }
    await page.close();
  });

  // ── Microsoft TMT ────────────────────────────────────────────────────────────

  test("US-12.3: POST /import/tool accepts Microsoft TMT XML and creates model", async ({
    page,
  }) => {
    await login(page);

    const res = await apiPost<{
      modelId?: string;
      source?: string;
      componentCount?: number;
      connectionCount?: number;
      threatCount?: number;
    }>(page, "/api/threat-models/import/tool", {
      content: TMT_XML,
      filename: "model.tm7",
      name: "E2E TMT Import Test",
    });

    expect(res.modelId).toBeTruthy();
    expect(res.source).toBe("microsoft-tmt");
    expect(res.componentCount).toBeGreaterThanOrEqual(2);
    expect(res.connectionCount).toBeGreaterThanOrEqual(1);
    expect(res.threatCount).toBeGreaterThanOrEqual(1);

    if (res.modelId) createdModelIds.push(res.modelId);

    // Verify model is retrievable
    const model = await apiGet<{ id: string; canvasState?: string }>(
      page,
      `/api/threat-models/${res.modelId}`,
    );
    expect(model.id).toBe(res.modelId);
  });

  test("US-12.3: TMT import canvas contains extracted components", async ({
    page,
  }) => {
    await login(page);

    const res = await apiPost<{ modelId?: string; componentCount?: number }>(
      page,
      "/api/threat-models/import/tool",
      { content: TMT_XML, filename: "model.tm7" },
    );
    if (!res.modelId) {
      test.skip();
      return;
    }
    createdModelIds.push(res.modelId);

    const model = await apiGet<{
      canvasState?: string;
    }>(page, `/api/threat-models/${res.modelId}`);

    const canvas =
      typeof model.canvasState === "string"
        ? JSON.parse(model.canvasState)
        : (model.canvasState ?? {});
    expect(Array.isArray(canvas.nodes)).toBe(true);
    expect(canvas.nodes.length).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(canvas.edges)).toBe(true);
    expect(canvas.edges.length).toBeGreaterThanOrEqual(1);
  });

  test("US-12.3: TMT imported threats are persisted", async ({ page }) => {
    await login(page);

    const res = await apiPost<{ modelId?: string; threatCount?: number }>(
      page,
      "/api/threat-models/import/tool",
      { content: TMT_XML, filename: "model.tm7" },
    );
    if (!res.modelId) {
      test.skip();
      return;
    }
    createdModelIds.push(res.modelId);

    const threats = await apiGet<Array<{ id: string; name: string }>>(
      page,
      `/api/threat-models/${res.modelId}/threats`,
    );
    const arr = Array.isArray(threats) ? threats : [];
    expect(arr.length).toBeGreaterThanOrEqual(1);
    expect(arr[0]?.name).toBeTruthy();
  });

  // ── OWASP Threat Dragon ───────────────────────────────────────────────────────

  test("US-12.3: POST /import/tool accepts OWASP Threat Dragon JSON", async ({
    page,
  }) => {
    await login(page);

    const res = await apiPost<{
      modelId?: string;
      source?: string;
      componentCount?: number;
      threatCount?: number;
    }>(page, "/api/threat-models/import/tool", {
      content: DRAGON_JSON,
      filename: "model.json",
      name: "E2E Dragon Import Test",
    });

    expect(res.modelId).toBeTruthy();
    expect(res.source).toBe("owasp-dragon");
    expect(res.componentCount).toBeGreaterThanOrEqual(2);

    if (res.modelId) createdModelIds.push(res.modelId);
  });

  test("US-12.3: Dragon import preserves threat data", async ({ page }) => {
    await login(page);

    const res = await apiPost<{ modelId?: string }>(
      page,
      "/api/threat-models/import/tool",
      { content: DRAGON_JSON, filename: "model.json" },
    );
    if (!res.modelId) {
      test.skip();
      return;
    }
    createdModelIds.push(res.modelId);

    const threats = await apiGet<Array<{ id: string; name: string }>>(
      page,
      `/api/threat-models/${res.modelId}/threats`,
    );
    const arr = Array.isArray(threats) ? threats : [];
    // Dragon JSON fixture includes 1 threat on the flow
    expect(arr.length).toBeGreaterThanOrEqual(1);
  });

  // ── Threagile ─────────────────────────────────────────────────────────────────

  test("US-12.3: POST /import/tool accepts Threagile YAML", async ({
    page,
  }) => {
    await login(page);

    const res = await apiPost<{
      modelId?: string;
      source?: string;
      componentCount?: number;
    }>(page, "/api/threat-models/import/tool", {
      content: THREAGILE_YAML,
      filename: "model.yaml",
      name: "E2E Threagile Import Test",
    });

    expect(res.modelId).toBeTruthy();
    expect(res.source).toBe("threagile");
    expect(res.componentCount).toBeGreaterThanOrEqual(2);

    if (res.modelId) createdModelIds.push(res.modelId);
  });

  test("US-12.3: Threagile import canvas has nodes for each technical asset", async ({
    page,
  }) => {
    await login(page);

    const res = await apiPost<{ modelId?: string }>(
      page,
      "/api/threat-models/import/tool",
      { content: THREAGILE_YAML, filename: "model.yaml" },
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
    expect(canvas.nodes?.length).toBeGreaterThanOrEqual(2);
  });

  // ── Unknown format ────────────────────────────────────────────────────────────

  test("US-12.3: POST /import/tool rejects unrecognised content", async ({
    page,
  }) => {
    await login(page);

    // Plaintext that matches no known format
    const caught = await apiPost<{ error?: string }>(
      page,
      "/api/threat-models/import/tool",
      { content: "this is not a threat model", filename: "random.txt" },
    ).catch((e: Error) => ({ error: e.message }));

    // Should get a 400 (bad request) since content is unrecognised
    expect((caught as { error?: string }).error).toBeTruthy();
  });
});
