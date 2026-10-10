/**
 * Tour 02 — Greenfield Build (Online Checkout)
 *
 * Demonstrates building a threat model from scratch by "dragging" components
 * from the palette. Since real HTML5 drag-drop doesn't propagate cleanly
 * through Playwright/CDP, each "drag" step calls the save-canvas API with
 * the next incremental state and reloads the page to reflect it. The visual
 * effect is identical to what the user would see with real drag-and-drop.
 *
 * Final model: "Online Checkout — Greenfield Demo" with 5 components + 4
 * connections + 1 trust boundary. Used as input by Tour 03 (AI threats).
 *
 * Run: TOUR_BASE_URL=https://threatforge.bpmforge.com npx playwright test \
 *      --project=product-tour 02-greenfield-build.spec.ts
 */
import { test, type Page } from "@playwright/test";
import { TourRecorder, TOUR_VIEWPORT } from "./_recorder";

import { WRITER_EMAIL, WRITER_PASSWORD, writerSkipReason } from "../accounts";

// Tours create and edit models; the demo login is read-only on prod.
test.skip(!!writerSkipReason(), writerSkipReason() ?? "");
const MODEL_NAME = "Online Checkout — Greenfield Demo";

// ── Node factory ─────────────────────────────────────────────────────────────
interface NodeSpec {
  id: string;
  label: string;
  type:
    | "ACTOR"
    | "WEB_APP"
    | "API"
    | "EXTERNAL_ENTITY"
    | "DATA_STORE"
    | "DATABASE";
  position: { x: number; y: number };
  trustLevel: "EXTERNAL" | "INTERNAL" | "TRUSTED" | "RESTRICTED";
}

const makeNode = (n: NodeSpec) => ({
  id: n.id,
  type: "component",
  position: n.position,
  data: {
    label: n.label,
    type: n.type,
    trustLevel: n.trustLevel,
  },
});

const makeEdge = (
  id: string,
  source: string,
  target: string,
  opts: Partial<{ protocol: string; encrypted: boolean; auth: string }> = {},
) => ({
  id,
  source,
  target,
  type: "security",
  data: {
    protocol: opts.protocol || "HTTPS",
    encrypted: opts.encrypted ?? true,
    authenticated: (opts.auth ?? "Bearer Token") !== "None",
    authentication: opts.auth || "Bearer Token",
    dataClassifications: [],
    style: { lineStyle: "smoothstep" },
  },
});

const makeBoundary = (
  id: string,
  label: string,
  position: { x: number; y: number },
  size: { width: number; height: number },
) => ({
  id,
  type: "boundary",
  position,
  style: { width: size.width, height: size.height },
  zIndex: -1000,
  data: { label, trustLevel: "INTERNAL" },
});

// ── Online Checkout layout ───────────────────────────────────────────────────
const CUSTOMER = makeNode({
  id: "node-customer",
  label: "Customer",
  type: "ACTOR",
  position: { x: 30, y: 220 },
  trustLevel: "EXTERNAL",
});
const WEB = makeNode({
  id: "node-web",
  label: "Checkout Web",
  type: "WEB_APP",
  position: { x: 230, y: 220 },
  trustLevel: "INTERNAL",
});
const API = makeNode({
  id: "node-api",
  label: "Payment API",
  type: "API",
  position: { x: 450, y: 220 },
  trustLevel: "INTERNAL",
});
const STRIPE = makeNode({
  id: "node-stripe",
  label: "Stripe",
  type: "EXTERNAL_ENTITY",
  position: { x: 680, y: 80 },
  trustLevel: "EXTERNAL",
});
const ORDERS_DB = makeNode({
  id: "node-orders",
  label: "Orders Database",
  type: "DATA_STORE",
  position: { x: 450, y: 420 },
  trustLevel: "RESTRICTED",
});
const TRUST_BOUNDARY = makeBoundary(
  "boundary-internal",
  "Internal Services",
  { x: 200, y: 160 },
  { width: 540, height: 360 },
);

const EDGES = [
  makeEdge("edge-1", "node-customer", "node-web", {
    protocol: "HTTPS",
    auth: "None",
  }),
  makeEdge("edge-2", "node-web", "node-api", {
    protocol: "HTTPS",
    auth: "Bearer Token",
  }),
  makeEdge("edge-3", "node-api", "node-stripe", {
    protocol: "HTTPS",
    auth: "API Key",
  }),
  makeEdge("edge-4", "node-api", "node-orders", {
    protocol: "TLS",
    auth: "mTLS",
  }),
];

// ── Helper: save canvas via API (uses page's session cookie) ────────────────
async function saveCanvasAndReload(
  page: Page,
  modelId: string,
  nodes: object[],
  edges: object[] = [],
) {
  const result = await page.evaluate(
    async ({ id, nodes, edges }) => {
      const res = await fetch(`/api/threat-models/${id}/save-canvas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nodes,
          edges,
          viewport: { x: 0, y: 0, zoom: 1 },
        }),
      });
      return {
        ok: res.ok,
        status: res.status,
        text: res.ok ? null : await res.text(),
      };
    },
    { id: modelId, nodes, edges },
  );
  if (!result.ok)
    throw new Error(`save-canvas failed: ${result.status} ${result.text}`);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="rf__wrapper"]', {
    state: "visible",
  });
  await page.waitForTimeout(800); // let React Flow render
}

// ── Helper: extract modelId from current URL ────────────────────────────────
function getModelIdFromUrl(page: Page): string {
  const m = page.url().match(/\/models\/([^/?#]+)/);
  if (!m) throw new Error(`Not on a model page: ${page.url()}`);
  return m[1];
}

test.describe("Tour 02 — Greenfield Build", () => {
  test.use({ viewport: TOUR_VIEWPORT });

  test("records tour", async ({ page }) => {
    test.setTimeout(300_000);

    const tour = new TourRecorder({
      slug: "02-greenfield-build",
      title: "Tour 2 — Greenfield Build",
      subtitle:
        "Build a threat model from scratch by dragging components onto the canvas. We'll model a simple Online Checkout flow with five components and four data flows.",
      audience:
        "Security architects who know their system and want to draw it. Shows the component palette, trust boundaries, connections, and the properties panel.",
    });

    // ── Setup: login, create the Online Checkout model, land on blank canvas ──
    await page.goto("/login");
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', WRITER_EMAIL);
    await page.fill('input[type="password"]', WRITER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Dashboard may have "Create Your First Project" (empty) or "New Model" (populated)
    const newModelButton = page
      .getByRole("button", {
        name: /create your first threat model|new model/i,
      })
      .first();
    await newModelButton.click();
    await page.waitForSelector('input[id="name"]', { state: "visible" });
    await page.fill('input[id="name"]', MODEL_NAME);
    await page.getByRole("button", { name: /create model/i }).click();
    await page.waitForURL("**/models/**", { timeout: 15000 });
    await page.waitForSelector('[data-testid="rf__wrapper"]', {
      state: "visible",
    });
    await page.waitForLoadState("networkidle");

    const modelId = getModelIdFromUrl(page);

    // ── Step 1: Fresh blank canvas ───────────────────────────────────────────
    await tour.step(page, {
      caption:
        "We start with a fresh **Online Checkout** model on a blank canvas. This is the greenfield workflow — you know the system you're modeling, so you'll drag components in by hand. Tours 4 and 5 show document-driven and code-driven approaches for when you don't want to start from zero.",
      settleMs: 800,
    });

    // ── Step 2: Palette overview ─────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "The **component palette** on the left. Eleven categories, hundreds of components: DFD primitives (Actor, Process, Data Store), application types (Web App, API, Mobile), data stores, networking, security controls, infrastructure, and full AWS/Azure/GCP service libraries. Every item is draggable straight onto the canvas.",
      highlight: '[draggable="true"]:has-text("Trust Boundary")',
      settleMs: 300,
    });

    // ── Step 3: Add Customer (Actor) ─────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Drag an **Actor** onto the canvas to represent the Customer — an external user with no trust inside your network. Actors are the entry points your threat model will reason about: every attack starts with someone or something initiating a data flow.",
      action: async () => {
        await saveCanvasAndReload(page, modelId, [CUSTOMER]);
      },
      highlight:
        '[draggable="true"]:has-text("Actor"):not(:has-text("External"))',
      settleMs: 500,
    });

    // ── Step 4: Add Checkout Web ─────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Drag a **Web App** for the Checkout Web frontend. This is the customer-facing surface — typically a React or Next.js SPA backed by an API. It sits inside your trust boundary but receives direct input from untrusted users, which is where most STRIDE threats originate.",
      action: async () => {
        await saveCanvasAndReload(page, modelId, [CUSTOMER, WEB]);
      },
      highlight: '[draggable="true"]:has-text("Web App")',
      settleMs: 500,
    });

    // ── Step 5: Add Payment API ──────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Drag a **REST/GraphQL API** for the Payment API. This handles order creation, payment tokenization, and talks to both the database and the external payment processor. Typical concerns: authentication, rate limiting, and safe handling of PII + payment data.",
      action: async () => {
        await saveCanvasAndReload(page, modelId, [CUSTOMER, WEB, API]);
      },
      highlight: '[draggable="true"]:has-text("REST/GraphQL API")',
      settleMs: 500,
    });

    // ── Step 6: Add Stripe (External Entity) ─────────────────────────────────
    await tour.step(page, {
      caption:
        "Drag an **External Entity** for Stripe. Third-party processors are distinct from your own components — you don't control their security, but you depend on them for payment and carry liability for the integration. ThreatForge tracks external entities separately so supply-chain and vendor risk show up in reports.",
      action: async () => {
        await saveCanvasAndReload(page, modelId, [CUSTOMER, WEB, API, STRIPE]);
      },
      highlight: '[draggable="true"]:has-text("External Entity")',
      settleMs: 500,
    });

    // ── Step 7: Add Orders Database ──────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Drag a **Data Store** for the Orders Database. Data stores with sensitive content (payment data, PII) are automatically flagged when we run compliance mapping in Tour 7 — PCI-DSS and GDPR controls will attach to this node as soon as we label it as storing cardholder data.",
      action: async () => {
        await saveCanvasAndReload(page, modelId, [
          CUSTOMER,
          WEB,
          API,
          STRIPE,
          ORDERS_DB,
        ]);
      },
      highlight: '[draggable="true"]:has-text("Data Store")',
      settleMs: 500,
    });

    // ── Step 8: Connect them ─────────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Connect the components to show **data flows**. Each edge represents a real network call: Customer → Web, Web → API, API → Stripe, API → Orders DB. Edges carry protocol, encryption, and authentication metadata — that's what the STRIDE engine reads when it finds threats. Click a connection and the right panel exposes all of it.",
      action: async () => {
        await saveCanvasAndReload(
          page,
          modelId,
          [CUSTOMER, WEB, API, STRIPE, ORDERS_DB],
          EDGES,
        );
      },
      settleMs: 800,
    });

    // ── Step 9: Trust boundary ───────────────────────────────────────────────
    await tour.step(page, {
      caption:
        "Drop a **Trust Boundary** around the three internal services. Trust boundaries are where STRIDE really earns its keep — crossing one is the event that triggers most spoofing, tampering, and information-disclosure threats. The Customer and Stripe stay outside the boundary; every edge that crosses it becomes a point of interest for the AI analysis in Tour 3.",
      action: async () => {
        await saveCanvasAndReload(
          page,
          modelId,
          [TRUST_BOUNDARY, CUSTOMER, WEB, API, STRIPE, ORDERS_DB],
          EDGES,
        );
      },
      highlight: '[draggable="true"]:has-text("Trust Boundary")',
      settleMs: 800,
    });

    // ── Step 10: Select component → Properties panel ────────────────────────
    await tour.step(page, {
      caption:
        "Click any component — here, the Payment API — and the **Properties panel** opens on the right. This is where you set the component's trust level, data classifications, connection protocols, and technology stack. Every property you set becomes context for the AI threat suggestion we'll run next. Tour 3 walks through that analysis.",
      action: async () => {
        // Click the Payment API node to select it
        await page
          .locator(
            '[data-id="node-api"], .react-flow__node:has-text("Payment API")',
          )
          .first()
          .click();
        await page.waitForTimeout(600);
      },
      settleMs: 500,
    });

    await tour.finalize();
  });
});
