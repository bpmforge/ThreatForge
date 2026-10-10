/**
 * Post-Deploy Smoke Tests
 *
 * Runs in < 60 seconds against prod. Catches the class of failures that bit us
 * in the 2026-04-23 session:
 *   - Double-wrapped API responses (categories returned {data:[]} not [])
 *   - Demo account state (wrong models after E2E test contamination)
 *   - Container health (502 from exited containers after deploy)
 *   - Auth breakage (AUTH_URL misconfiguration causing cookie drop)
 *
 * Run: TOUR_BASE_URL=https://threatforge.bpmforge.com npx playwright test --project=smoke-prod
 */
import { test, expect, type APIResponse } from "@playwright/test";
import { EXPECTED_DEMO_MODELS, PUBLIC_HOST } from "../demo-models";
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  WRITER_EMAIL,
  WRITER_PASSWORD,
  writerSkipReason,
} from "../accounts";

// ── 1. Infrastructure health ─────────────────────────────────────────────────

/**
 * Prod fronts the app with nginx, whose /health* answers with the plain text
 * "healthy"; a bare Fastify answers with JSON. Accept either — the smoke
 * question is "is the stack up", not "which layer answered".
 */
async function expectHealthy(resp: APIResponse, jsonKeys: string[]) {
  expect(resp.status()).toBe(200);
  const text = (await resp.text()).trim();
  if (text.startsWith("{")) {
    const body = JSON.parse(text) as Record<string, unknown>;
    const hit = jsonKeys.some((k) => {
      const v = k
        .split(".")
        .reduce<unknown>(
          (o, part) => (o as Record<string, unknown> | undefined)?.[part],
          body,
        );
      return v === true || v === "healthy" || v === "ok";
    });
    expect(hit, `unexpected health body: ${text.slice(0, 120)}`).toBe(true);
  } else {
    expect(text.toLowerCase()).toMatch(/healthy|ok/);
  }
}

test("GET /health — stack is up", async ({ request }) => {
  await expectHealthy(await request.get("/health"), [
    "database.status",
    "checks.database.status",
    "status",
  ]);
});

test("GET /health/live — liveness probe", async ({ request }) => {
  await expectHealthy(await request.get("/health/live"), ["live", "status"]);
});

test("GET /health/ready — readiness probe", async ({ request }) => {
  await expectHealthy(await request.get("/health/ready"), ["ready", "status"]);
});

// ── 2. Auth ──────────────────────────────────────────────────────────────────

test("login page renders without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    // Third-party beacons (Cloudflare Insights) are blocked on some networks
    // and surface as ERR_CONNECTION_REFUSED; they are not app errors.
    if (
      msg.type() === "error" &&
      !msg.text().includes("favicon") &&
      !/ERR_CONNECTION_REFUSED|cloudflareinsights/.test(msg.text())
    )
      errors.push(msg.text().slice(0, 100));
  });
  await page.goto("/login");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
  expect(errors).toHaveLength(0);
});

test("demo account can log in and reach dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 20000 });
  const session = await page.evaluate(async () => {
    const r = await fetch("/api/auth/session", { credentials: "include" });
    return r.ok ? r.json() : null;
  });
  expect(session?.user?.email).toBe(DEMO_EMAIL);
});

test("unauthenticated request to protected API returns 401", async ({
  request,
}) => {
  const resp = await request.get("/api/threat-models");
  expect(resp.status()).toBe(401);
});

// ── 3. Demo account state ─────────────────────────────────────────────────────

test("demo account has ≥5 named models matching expected list", async ({
  page,
}) => {
  await page.goto("/login");
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 20000 });

  const models = await page.evaluate(async () => {
    const r = await fetch("/api/threat-models", { credentials: "include" });
    const b = await r.json();
    return (b.data ?? b).map((m: { name: string }) => m.name);
  });

  expect(
    models.length,
    "demo-tour account should hold the 5 seeded demo models — reseed prod (see EXPECTED_DEMO_MODELS)",
  ).toBeGreaterThanOrEqual(5);

  for (const expected of EXPECTED_DEMO_MODELS) {
    const found = models.some((name: string) =>
      name.includes(expected.split(" ")[0]),
    );
    expect(found, `Demo account missing model containing "${expected}"`).toBe(
      true,
    );
  }
});

test("demo account is read-only on the public host", async ({ page }) => {
  // The server lists the demo login in DEMO_READONLY_USER_EMAILS. Creating an
  // organization is how a demo session once escalated, so it is the probe.
  const target = test.info().project.use.baseURL ?? "http://localhost";
  test.skip(
    new URL(target).hostname !== PUBLIC_HOST,
    "only the public host promises a read-only demo",
  );
  await page.goto("/login");
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 20000 });

  const result = await page.evaluate(async () => {
    const r = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: `smoke-ro-${Date.now()}` }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  expect(result.status, "demo login must not be able to write").toBe(403);
  expect(result.body?.code).toBe("READ_ONLY_ACCOUNT");
  await expect(page.getByText("Demo — read-only")).toBeVisible();
});

// ── 4. API response shapes (regression for bugs found 2026-04-23) ────────────

test("GET /api/v1/model-templates/categories returns array not wrapped object", async ({
  page,
}) => {
  // Regression: this endpoint previously returned {data:{data:[]}} causing
  // TemplateGallery to crash when calling .map() on an object.
  await page.goto("/login");
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 20000 });

  const result = await page.evaluate(async () => {
    const r = await fetch("/api/v1/model-templates/categories", {
      credentials: "include",
    });
    const b = await r.json();
    return { status: r.status, isArray: Array.isArray(b), body: b };
  });

  expect(result.status).toBe(200);
  // apiClient unwraps {data:[...]} → the raw response should be {data:[...]}
  // and Array.isArray(body.data) should be true (not body.data.data)
  const categories = result.body?.data ?? result.body;
  expect(Array.isArray(categories)).toBe(true);
});

test("POST /api/threat-models/:id/save-canvas returns {success:true}", async ({
  page,
}) => {
  // Regression: save-canvas was switched to updateMany; mocks weren't updated
  // causing test failures. This confirms the live endpoint works end-to-end.
  // It writes, so it runs as the writer account: the demo login is read-only.
  test.skip(!!writerSkipReason(), writerSkipReason() ?? "");
  await page.goto("/login");
  await page.fill('input[type="email"]', WRITER_EMAIL);
  await page.fill('input[type="password"]', WRITER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 20000 });

  const result = await page.evaluate(async () => {
    // Create a temporary model
    const create = await fetch("/api/threat-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: `smoke-canvas-${Date.now()}` }),
    });
    const { data: model } = await create.json();

    // Save a canvas to it
    const save = await fetch(`/api/threat-models/${model.id}/save-canvas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        nodes: [
          {
            id: "n1",
            type: "component",
            position: { x: 0, y: 0 },
            data: { label: "Test", type: "SERVICE", trustLevel: "INTERNAL" },
          },
        ],
        edges: [],
      }),
    });
    const saveBody = await save.json();

    // Clean up
    await fetch(`/api/threat-models/${model.id}`, {
      method: "DELETE",
      credentials: "include",
    });

    return { createStatus: create.status, saveStatus: save.status, saveBody };
  });

  expect(result.createStatus).toBe(201);
  expect(result.saveStatus).toBe(200);
  expect(result.saveBody?.data?.success ?? result.saveBody?.success).toBe(true);
});

// ── 5. Canvas page renders ───────────────────────────────────────────────────

test("canvas editor loads for a model without application errors", async ({
  page,
}) => {
  // Login (~5s) + model fetch + canvas mount + collab sync on a cold prod
  // container can exceed the 30s default; the selector wait alone is 30s.
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message.slice(0, 150)));

  await page.goto("/login");
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 20000 });

  // Get first model id
  const modelId = await page.evaluate(async () => {
    const r = await fetch("/api/threat-models", { credentials: "include" });
    const b = await r.json();
    return (b.data ?? b)[0]?.id;
  });

  expect(modelId, "No models on demo account").toBeTruthy();

  await page.goto(`/models/${modelId}`);
  await page.waitForSelector('[data-testid="rf__wrapper"]', { timeout: 30000 });
  // Not `networkidle`: a retrying third-party beacon can keep the network
  // busy indefinitely on prod.
  await page
    .waitForSelector(".react-flow__node", { timeout: 15000 })
    .catch(() => {});

  expect(errors, `Canvas crashed: ${errors.join("; ")}`).toHaveLength(0);
});
