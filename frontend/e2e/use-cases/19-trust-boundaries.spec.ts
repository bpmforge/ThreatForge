/**
 * UC-19: Trust boundaries (US-3.5) — live canvas interaction
 *
 * The parts of UC-19 the API-seeded UC-12 cannot cover, driven with a real
 * mouse the way a user would:
 *   1. Drop a component INTO a boundary → it becomes a child and the boundary
 *      GROWS to fit (never shrinks to the minimum).
 *   2. Move the boundary → every child travels with it.
 *   3. Drag the child OUT → parent relationship cleared.
 *   4. Draw a connection by dragging handle → handle. The edge keeps the drag
 *      direction (source = dragged-from node), renders, and is strictly
 *      orthogonal (Manhattan routing — no diagonal segments).
 *   5. Reload → parentage, sizes and the edge all survive a round-trip.
 *
 * Positions are read from React Flow's node wrappers (`transform:
 * translate(x, y)` is in absolute flow coordinates), so the assertions do not
 * depend on the viewport zoom.
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
  makeBoundary,
} from "./_fixtures";
import type { Page } from "@playwright/test";

const BOUNDARY = "uc19-boundary";
const A = "uc19-a";
const B = "uc19-b";

interface NodeGeom {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

async function readNodes(page: Page): Promise<Record<string, NodeGeom>> {
  const list = await page.$$eval(".react-flow__node", (els) =>
    els.map((el) => {
      const e = el as HTMLElement;
      const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(
        e.style.transform,
      );
      return {
        id: e.getAttribute("data-id") ?? "",
        x: m ? parseFloat(m[1]) : NaN,
        y: m ? parseFloat(m[2]) : NaN,
        w: parseFloat(e.style.width) || e.offsetWidth,
        h: parseFloat(e.style.height) || e.offsetHeight,
      };
    }),
  );
  return Object.fromEntries(list.map((n) => [n.id, n]));
}

async function readEdgePaths(page: Page): Promise<string[]> {
  // The drawn line, not the marker/hit paths that share the edge group.
  const sel = ".react-flow__edge .react-flow__edge-path";
  await page
    .locator(sel)
    .first()
    .waitFor({ state: "attached", timeout: 5_000 });
  return page.$$eval(sel, (els) => els.map((el) => el.getAttribute("d") ?? ""));
}

/** Every segment of an M/L polyline must change on exactly one axis. */
function isOrthogonal(d: string): boolean {
  const pts = [...d.matchAll(/[ML]\s*([-\d.]+)\s+([-\d.]+)/g)].map((m) => ({
    x: parseFloat(m[1]),
    y: parseFloat(m[2]),
  }));
  if (pts.length < 2) return false;
  for (let i = 1; i < pts.length; i++) {
    const dx = Math.abs(pts[i].x - pts[i - 1].x);
    const dy = Math.abs(pts[i].y - pts[i - 1].y);
    if (dx > 0.5 && dy > 0.5) return false;
  }
  return true;
}

function inside(child: NodeGeom, box: NodeGeom): boolean {
  return (
    child.x >= box.x &&
    child.y >= box.y &&
    child.x + child.w <= box.x + box.w &&
    child.y + child.h <= box.y + box.h
  );
}

async function dragByScreen(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 4, from.y + 4, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

async function centerOf(page: Page, nodeId: string) {
  const box = await page
    .locator(`.react-flow__node[data-id="${nodeId}"]`)
    .boundingBox();
  if (!box) throw new Error(`node ${nodeId} not on screen`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Drag a node so its centre lands on a given flow-coordinate point. */
async function dragNodeToFlow(
  page: Page,
  nodeId: string,
  target: { x: number; y: number },
) {
  const nodes = await readNodes(page);
  const n = nodes[nodeId];
  const zoom = await page.evaluate(() => {
    const vp = document.querySelector(".react-flow__viewport") as HTMLElement;
    const m = /scale\(([\d.]+)\)/.exec(vp.style.transform);
    return m ? parseFloat(m[1]) : 1;
  });
  const from = await centerOf(page, nodeId);
  const dx = (target.x - (n.x + n.w / 2)) * zoom;
  const dy = (target.y - (n.y + n.h / 2)) * zoom;
  await dragByScreen(page, from, { x: from.x + dx, y: from.y + dy });
}

test.describe("UC-19 — Trust boundaries (live canvas)", () => {
  let modelId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    const model = await createModel(page, "Test — UC-19 Trust Boundaries");
    modelId = model.id;
    await saveCanvas(page, modelId, [
      makeBoundary(
        BOUNDARY,
        "Internal Zone",
        { x: 100, y: 100 },
        {
          width: 400,
          height: 300,
        },
      ),
      makeNode({
        id: A,
        label: "Alpha API",
        type: "API",
        position: { x: 700, y: 120 },
      }),
      makeNode({
        id: B,
        label: "Bravo Web",
        type: "WEB_APP",
        position: { x: 700, y: 420 },
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

  test("drop in, move together, drag out, connect, reload", async ({
    page,
  }) => {
    await login(page);
    // The Guided Wizard auto-opens while the canvas is still syncing (zero
    // nodes for a moment) and would swallow every pointer event below.
    await page.goto("/dashboard");
    await page.evaluate(
      (id) => localStorage.setItem(`wizard-dismissed-${id}`, "1"),
      modelId,
    );
    await navigateToModel(page, modelId);
    await page.keyboard.press("Escape");
    await expect(page.locator(`.react-flow__node[data-id="${A}"]`)).toBeVisible(
      {
        timeout: 15_000,
      },
    );
    // Fit the whole scene so every drag target is on screen.
    await page.locator(".react-flow__controls-fitview").click();
    await page.waitForTimeout(400);

    // ── 1. Drop Alpha near the boundary's bottom-right: it must be adopted
    //       and the boundary must GROW (regression: it used to shrink to
    //       200×150 because the resize read a stale node list).
    await dragNodeToFlow(page, A, { x: 420, y: 330 });
    let g = await readNodes(page);
    expect(g[BOUNDARY].w).toBeGreaterThanOrEqual(400);
    expect(g[BOUNDARY].h).toBeGreaterThanOrEqual(300);
    expect(inside(g[A], g[BOUNDARY])).toBe(true);
    await expect(
      page.locator(`.react-flow__node[data-id="${BOUNDARY}"]`),
    ).not.toContainText("Drag components here");
    const childBefore = { x: g[A].x, y: g[A].y };
    const boundaryBefore = { x: g[BOUNDARY].x, y: g[BOUNDARY].y };

    // ── 2. Move the boundary by its header: the child travels with it.
    const header = page
      .locator(
        `.react-flow__node[data-id="${BOUNDARY}"] [class*="header" i], .react-flow__node[data-id="${BOUNDARY}"]`,
      )
      .first();
    const hb = await header.boundingBox();
    if (!hb) throw new Error("boundary not on screen");
    await dragByScreen(
      page,
      { x: hb.x + 24, y: hb.y + 16 },
      { x: hb.x + 24, y: hb.y + 16 + 90 },
    );
    g = await readNodes(page);
    const dBoundary = {
      x: g[BOUNDARY].x - boundaryBefore.x,
      y: g[BOUNDARY].y - boundaryBefore.y,
    };
    expect(Math.abs(dBoundary.y)).toBeGreaterThan(20);
    // The child travels with the zone. A fit/adopt during the move may shift
    // it by the 10px clearance, so compare within that tolerance.
    expect(Math.abs(g[A].x - childBefore.x - dBoundary.x)).toBeLessThan(12);
    expect(Math.abs(g[A].y - childBefore.y - dBoundary.y)).toBeLessThan(12);
    expect(inside(g[A], g[BOUNDARY])).toBe(true);

    // ── 3. Drag Alpha OUT: parent cleared, it lands where it was dropped
    //       (regression: `extent: "parent"` pinned it to the boundary edge).
    await dragNodeToFlow(page, A, { x: 760, y: 150 });
    g = await readNodes(page);
    expect(inside(g[A], g[BOUNDARY])).toBe(false);
    expect(g[A].x).toBeGreaterThan(g[BOUNDARY].x + g[BOUNDARY].w);
    await expect(
      page.locator(`.react-flow__node[data-id="${BOUNDARY}"]`),
    ).toContainText("Drag components here");

    // ── 4. Connect Bravo → Alpha by dragging from Bravo's RIGHT handle.
    //       Direction must follow the drag (regression: the target handle
    //       sat on top of the source handle and the edge came out reversed).
    const src = page.locator(
      `.react-flow__node[data-id="${B}"] .react-flow__handle[data-handleid="handle-right"]`,
    );
    const tgt = page.locator(
      `.react-flow__node[data-id="${A}"] .react-flow__handle[data-handleid="handle-left"]`,
    );
    const sb = await src.boundingBox();
    const tb = await tgt.boundingBox();
    if (!sb || !tb) throw new Error("handles not on screen");
    await dragByScreen(
      page,
      { x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 },
      { x: tb.x + tb.width / 2, y: tb.y + tb.height / 2 },
    );
    await expect(page.locator(".react-flow__edge")).toHaveCount(1, {
      timeout: 5_000,
    });
    let paths = await readEdgePaths(page);
    expect(isOrthogonal(paths[0])).toBe(true);
    g = await readNodes(page);
    const start = /M\s*([-\d.]+)\s+([-\d.]+)/.exec(paths[0])!;
    // Starts at Bravo's right edge (source), not Alpha's.
    expect(parseFloat(start[1])).toBeCloseTo(g[B].x + g[B].w, -1);

    // ── 5. Round-trip: nothing is lost on reload.
    await page
      .locator('button:has-text("Save")')
      .first()
      .click()
      .catch(() => {});
    await page.waitForTimeout(1_500);
    await page.reload();
    await expect(page.locator(`.react-flow__node[data-id="${A}"]`)).toBeVisible(
      {
        timeout: 15_000,
      },
    );
    await expect(page.locator(".react-flow__edge")).toHaveCount(1, {
      timeout: 10_000,
    });
    paths = await readEdgePaths(page);
    expect(isOrthogonal(paths[0])).toBe(true);
    const after = await readNodes(page);
    expect(after[BOUNDARY].w).toBeCloseTo(g[BOUNDARY].w, 0);
    expect(after[A].x).toBeCloseTo(g[A].x, 0);
    expect(inside(after[A], after[BOUNDARY])).toBe(false);
  });
});
