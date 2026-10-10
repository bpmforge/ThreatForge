/**
 * UC-24: Connector polish (US-3.4 / Lucid-Lines) — live canvas interaction
 *
 * The connector behaviours that put the home-grown canvas on par with
 * Lucidchart / draw.io, driven with a real mouse:
 *   1. Hovering a line highlights it (blue stroke, thicker).
 *   2. Releasing a connection on a shape BODY attaches it (floating drop),
 *      entering through the side that faces the source; no quick-add picker.
 *   3. A line from a top/bottom port leaves perpendicular to that side.
 *   4. Double-clicking a line opens its label for editing.
 *   5. Dragging a bend back to within a few px of its neighbours' axis snaps
 *      and the redundant corner collapses (Manhattan run stays minimal).
 */
import {
  test,
  expect,
  login,
  createModel,
  deleteModel,
  navigateToModel,
  saveCanvas,
  makeNode,
} from "./_fixtures";
import type { Page } from "@playwright/test";

const A = "uc24-a";
const B = "uc24-b";
const C = "uc24-c";

function parsePath(d: string) {
  return [...d.matchAll(/[ML]\s*([-\d.]+)\s+([-\d.]+)/g)].map((m) => ({
    x: parseFloat(m[1]),
    y: parseFloat(m[2]),
  }));
}

function isOrthogonal(d: string): boolean {
  const pts = parsePath(d);
  if (pts.length < 2) return false;
  return pts.every(
    (p, i) =>
      i === 0 ||
      Math.abs(p.x - pts[i - 1].x) < 0.5 ||
      Math.abs(p.y - pts[i - 1].y) < 0.5,
  );
}

async function edgePaths(page: Page) {
  return page.$$eval(".react-flow__edge", (els) =>
    els.map((el) => ({
      id: el.getAttribute("data-id") ?? "",
      d: el.querySelector(".react-flow__edge-path")?.getAttribute("d") ?? "",
    })),
  );
}

async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 3, from.y + 3, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

async function center(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`${selector} not on screen`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const node = (id: string) => `.react-flow__node[data-id="${id}"]`;
const handle = (id: string, h: string) =>
  `${node(id)} .react-flow__handle[data-handleid="${h}"]`;

test.describe("UC-24 — Connector polish (live canvas)", () => {
  let modelId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    const model = await createModel(page, "Test — UC-24 Connector Polish");
    modelId = model.id;
    await saveCanvas(page, modelId, [
      makeNode({
        id: A,
        label: "Alpha Web",
        type: "WEB_APP",
        position: { x: 100, y: 100 },
      }),
      makeNode({
        id: B,
        label: "Bravo API",
        type: "API",
        position: { x: 500, y: 100 },
      }),
      makeNode({
        id: C,
        label: "Charlie DB",
        type: "DATABASE",
        position: { x: 500, y: 400 },
      }),
    ]);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    await deleteModel(page, modelId).catch(() => {});
    await page.close();
  });

  test("drop-on-shape, port-side routing, hover, double-click label, bend collapse", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.evaluate(
      (id) => localStorage.setItem(`wizard-dismissed-${id}`, "1"),
      modelId,
    );
    await navigateToModel(page, modelId);
    await page.keyboard.press("Escape");
    await expect(page.locator(node(A))).toBeVisible({ timeout: 15_000 });
    await page.locator(".react-flow__controls-fitview").click();
    await page.waitForTimeout(400);

    // ── 2. Floating drop: from Alpha's right port onto Bravo's BODY.
    const aRight = await center(page, handle(A, "handle-right"));
    const bBody = await center(page, node(B));
    await drag(page, aRight, bBody);
    await expect(page.locator(".react-flow__edge")).toHaveCount(1, {
      timeout: 5_000,
    });
    // No quick-add picker was opened.
    await expect(page.getByText("ADD CONNECTED SHAPE")).toHaveCount(0);
    let paths = await edgePaths(page);
    expect(isOrthogonal(paths[0].d)).toBe(true);
    const ab = parsePath(paths[0].d);
    // Leaves Alpha to the right, enters Bravo from its left (facing side).
    expect(ab[1].x).toBeGreaterThan(ab[0].x);
    expect(ab[ab.length - 2].x).toBeLessThan(ab[ab.length - 1].x);

    // ── 3. Port-side routing: from Bravo's BOTTOM port onto Charlie's body.
    const bBottom = await center(page, handle(B, "handle-bottom-s"));
    const cBody = await center(page, node(C));
    await drag(page, bBottom, cBody);
    await expect(page.locator(".react-flow__edge")).toHaveCount(2, {
      timeout: 5_000,
    });
    paths = await edgePaths(page);
    const bc = parsePath(paths[1].d);
    expect(isOrthogonal(paths[1].d)).toBe(true);
    // First move is straight DOWN out of the bottom port…
    expect(bc[1].x).toBeCloseTo(bc[0].x, 0);
    expect(bc[1].y).toBeGreaterThan(bc[0].y);
    // …and it enters Charlie from the top (facing side).
    expect(bc[bc.length - 2].y).toBeLessThan(bc[bc.length - 1].y);

    // ── 1. Hover highlight on the A→B line (mid-point of its first segment).
    await page.mouse.move(10, 10);
    const edgeSel = `.react-flow__edge[data-id="${paths[0].id}"]`;
    const linePath = page.locator(`${edgeSel} .react-flow__edge-path`);
    const restingStroke = await linePath.evaluate(
      (el) => (el as SVGPathElement).style.stroke,
    );
    const lineBox = await page.locator(`${edgeSel} path`).first().boundingBox();
    if (!lineBox) throw new Error("edge not on screen");
    await page.mouse.move(
      lineBox.x + lineBox.width / 2,
      lineBox.y + lineBox.height / 2,
    );
    await page.waitForTimeout(200);
    const hoverStroke = await linePath.evaluate(
      (el) => (el as SVGPathElement).style.stroke,
    );
    expect(hoverStroke).not.toBe(restingStroke);
    expect(hoverStroke).toBe("rgb(96, 165, 250)");
    await page.mouse.move(10, 10);

    // ── 4. Double-click the line → label editor → type → Enter.
    await page.mouse.dblclick(
      lineBox.x + lineBox.width / 2,
      lineBox.y + lineBox.height / 2,
    );
    const editor = page.locator(".react-flow__edgelabel-renderer input");
    await expect(editor).toBeVisible({ timeout: 3_000 });
    await editor.fill("Login request");
    await editor.press("Enter");
    await expect(page.locator(".react-flow__edgelabel-renderer")).toContainText(
      "Login request",
    );
    // …and it went to the MID label, not an end label.
    await expect(
      page
        .locator(
          '.react-flow__edgelabel-renderer [title="Double-click to edit end label"]',
        )
        .filter({ hasText: "Login request" }),
    ).toHaveCount(0);

    // ── 5. Bend collapse: select A→B, drag its middle segment away (adds a
    //       jog), then drag it back to within a few px of the original axis;
    //       the jog must collapse back to the minimal run.
    await page.locator(`${edgeSel} path`).first().click({ force: true });
    await page.waitForTimeout(200);
    const before = parsePath((await edgePaths(page))[0].d);
    // Grab the LONG middle segment's band (not an end stub — those sit under
    // the node's quick-connect arrow) and pull it down: the auto-routed
    // segment gains a jog.
    const bandOf = async () => {
      const boxes = await page
        .locator(`${edgeSel} g[style*="cursor"] rect`)
        .evaluateAll((els) =>
          els.map((el) => {
            const r = (el as SVGRectElement).getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
          }),
        );
      return boxes
        .filter((b) => b.w > b.h && b.w > 40)
        .sort((p, q) => q.y - p.y)[0];
    };
    const band = await bandOf();
    if (!band) throw new Error("segment band not on screen");
    const grab = { x: band.x + band.w / 2, y: band.y + band.h / 2 };
    await drag(page, grab, { x: grab.x, y: grab.y + 80 });
    const jogged = parsePath((await edgePaths(page))[0].d);
    // The middle of the line now runs ~80px below its original axis.
    const axisY = before[0].y;
    expect(jogged.some((p) => p.y - axisY > 40)).toBe(true);
    expect(isOrthogonal((await edgePaths(page))[0].d)).toBe(true);
    // Now drag the displaced (lowest horizontal) segment back to within a
    // few px of its original axis: the magnet snaps it and the jog collapses.
    const displaced = await bandOf();
    await drag(
      page,
      { x: displaced.x + displaced.w / 2, y: displaced.y + displaced.h / 2 },
      { x: displaced.x + displaced.w / 2, y: grab.y + 3 },
    );
    // Snapped back onto the axis: every point is on the original line again.
    const collapsed = parsePath((await edgePaths(page))[0].d);
    expect(collapsed.every((p) => Math.abs(p.y - axisY) < 1)).toBe(true);
    expect(collapsed.length).toBeLessThanOrEqual(before.length);
  });
});
