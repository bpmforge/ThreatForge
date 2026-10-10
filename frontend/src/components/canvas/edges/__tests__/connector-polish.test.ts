/**
 * Connector polish: magnet-collapse of dragged segments, handle-side aware
 * routing, and floating (drop-on-shape) connection targeting.
 */
import { describe, it, expect } from "vitest";
import { Position } from "@xyflow/react";
import { magnet, ALIGN_SNAP } from "../usePillDragHandlers";
import {
  findOrthogonalRoute,
  simplifyWaypoints,
  orthogonalizeWaypoints,
} from "../orthogonal-router";
import { toRouteSide } from "../security-edge-utils";
import { pickFacingTargetHandle, isDroppableTarget } from "../connect-target";
import type { CanvasNode } from "@/stores/canvas";

describe("magnet — dragged segment snaps onto a neighbouring axis", () => {
  it("snaps within ALIGN_SNAP and leaves farther values alone", () => {
    expect(magnet(305, [304, 592])).toBe(304);
    expect(magnet(304 + ALIGN_SNAP, [304])).toBe(304);
    expect(magnet(304 + ALIGN_SNAP + 1, [304])).toBe(304 + ALIGN_SNAP + 1);
    expect(magnet(100, [])).toBe(100);
  });

  it("prefers the closest candidate", () => {
    expect(magnet(310, [304, 313])).toBe(313);
  });

  it("a snapped segment makes the corner collapse out of the run", () => {
    // Source at (413,304); a vertical segment dragged to x=410 stays a jog…
    const jog = simplifyWaypoints(
      orthogonalizeWaypoints([
        { x: 413, y: 304 },
        { x: 410, y: 304 },
        { x: 410, y: 592 },
        { x: 203, y: 592 },
      ]),
    );
    expect(jog).toHaveLength(4);
    // …but once the magnet lands it ON the source axis the jog disappears.
    const snappedX = magnet(410, [413, 203]);
    expect(snappedX).toBe(413);
    const straight = simplifyWaypoints(
      orthogonalizeWaypoints([
        { x: 413, y: 304 },
        { x: snappedX, y: 304 },
        { x: snappedX, y: 592 },
        { x: 203, y: 592 },
      ]),
    );
    expect(straight).toEqual([
      { x: 413, y: 304 },
      { x: 413, y: 592 },
      { x: 203, y: 592 },
    ]);
  });
});

describe("findOrthogonalRoute — honours the attached handle side", () => {
  const isOrthogonal = (pts: { x: number; y: number }[]) =>
    pts.every(
      (p, i) => i === 0 || p.x === pts[i - 1].x || p.y === pts[i - 1].y,
    );

  it("a line from a TOP port leaves upward first", () => {
    const pts = findOrthogonalRoute(100, 100, 400, 300, [], 12, "top", "left");
    expect(isOrthogonal(pts)).toBe(true);
    expect(pts[1]).toEqual({ x: 100, y: 88 }); // straight up by pad
    // …and enters the target from its left side.
    expect(pts[pts.length - 2]).toEqual({ x: 388, y: 300 });
  });

  it("a line from a BOTTOM port to a target below leaves downward and enters from the top", () => {
    const pts = findOrthogonalRoute(
      100,
      100,
      100,
      400,
      [],
      12,
      "bottom",
      "top",
    );
    expect(pts[1]).toEqual({ x: 100, y: 112 });
    expect(pts[pts.length - 2]).toEqual({ x: 100, y: 388 });
    expect(isOrthogonal(pts)).toBe(true);
  });

  it("falls back to the left/right heuristic when no side is given", () => {
    const pts = findOrthogonalRoute(100, 100, 400, 100, []);
    expect(pts[1]).toEqual({ x: 112, y: 100 });
  });

  it("maps React Flow positions to route sides", () => {
    expect(toRouteSide(Position.Top)).toBe("top");
    expect(toRouteSide(Position.Bottom)).toBe("bottom");
    expect(toRouteSide(Position.Left)).toBe("left");
    expect(toRouteSide(Position.Right)).toBe("right");
  });
});

describe("floating drop — which side of the shape the line enters", () => {
  const comp = (
    id: string,
    x: number,
    y: number,
    extra: Record<string, unknown> = {},
  ): CanvasNode =>
    ({
      id,
      type: "component",
      position: { x, y },
      measured: { width: 120, height: 64 },
      data: { label: id, type: "API", trustLevel: "INTERNAL", ...extra },
    }) as CanvasNode;

  it("enters through the side facing the source", () => {
    const s = comp("s", 0, 0);
    expect(pickFacingTargetHandle(s, comp("t", 400, 0), [s])).toBe(
      "handle-left",
    );
    expect(pickFacingTargetHandle(s, comp("t", -400, 0), [s])).toBe(
      "handle-right-t",
    );
    expect(pickFacingTargetHandle(s, comp("t", 0, 400), [s])).toBe(
      "handle-top",
    );
    expect(pickFacingTargetHandle(s, comp("t", 0, -400), [s])).toBe(
      "handle-bottom",
    );
  });

  it("defers to React Flow when the target renders interface handles", () => {
    const s = comp("s", 0, 0);
    const t = comp("t", 400, 0, {
      interfaces: [{ id: "i1", name: "HTTPS", position: "left" }],
    });
    expect(pickFacingTargetHandle(s, t, [s, t])).toBeNull();
  });

  it("only components other than the source are droppable", () => {
    const s = comp("s", 0, 0);
    expect(isDroppableTarget(s, "s")).toBe(false);
    expect(isDroppableTarget(comp("t", 1, 1), "s")).toBe(true);
    expect(
      isDroppableTarget(
        { ...comp("b", 0, 0), type: "boundary" } as CanvasNode,
        "s",
      ),
    ).toBe(false);
    expect(isDroppableTarget(undefined, "s")).toBe(false);
  });
});

describe("dragging an auto-routed segment moves it as one piece", () => {
  it("a straight run bent at its middle becomes a U-jog, not a collapsing spike", async () => {
    const { displacedSegment } = await import("../usePillDragHandlers");
    const seg = {
      start: { x: 262, y: 132 },
      end: { x: 485, y: 132 },
      midpoint: { x: 373.5, y: 132 },
      orientation: "horizontal" as const,
      waypointIndex: null,
      manual: false,
    };
    const bends = displacedSegment(seg, { x: 373, y: 212 });
    expect(bends).toEqual([
      { x: 262, y: 212 },
      { x: 485, y: 212 },
    ]);
    const run = simplifyWaypoints(
      orthogonalizeWaypoints([
        { x: 250, y: 132 },
        { x: 262, y: 132 },
        ...bends,
        { x: 485, y: 132 },
        { x: 497, y: 132 },
      ]),
    );
    expect(run).toEqual([
      { x: 250, y: 132 },
      { x: 262, y: 132 },
      { x: 262, y: 212 },
      { x: 485, y: 212 },
      { x: 485, y: 132 },
      { x: 497, y: 132 },
    ]);
    // …whereas a single bend at the cursor would have simplified away.
    const single = simplifyWaypoints(
      orthogonalizeWaypoints([
        { x: 250, y: 132 },
        { x: 262, y: 132 },
        { x: 373, y: 212 },
        { x: 485, y: 132 },
        { x: 497, y: 132 },
      ]),
    );
    expect(single).toEqual([
      { x: 250, y: 132 },
      { x: 497, y: 132 },
    ]);
  });
});

describe("ensureSegmentBends — every segment drag moves both ends", () => {
  const seg = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    waypointIndex: number | null,
  ) => ({
    start,
    end,
    midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    orientation: (start.y === end.y ? "horizontal" : "vertical") as
      | "horizontal"
      | "vertical",
    waypointIndex,
    manual: waypointIndex !== null,
  });

  it("inserts a bend for a segment start that is the edge's endpoint", async () => {
    const { ensureSegmentBends } = await import("../usePillDragHandlers");
    // Path: src(202,591) → wp0(481,591) → (481,543) → tgt(493,543)
    const corners = [{ x: 481, y: 591 }];
    const segments = [
      seg({ x: 202, y: 591 }, { x: 481, y: 591 }, 0),
      seg({ x: 481, y: 591 }, { x: 481, y: 543 }, null),
      seg({ x: 481, y: 543 }, { x: 493, y: 543 }, null),
    ];
    const r = ensureSegmentBends(corners, segments, 0);
    expect(r.live).toEqual([
      { x: 202, y: 591 },
      { x: 481, y: 591 },
    ]);
    expect(r.startIdx).toBe(0);
    expect(r.endIdx).toBe(1);
  });

  it("inserts both bends for a fully auto-routed segment, after the waypoints before it", async () => {
    const { ensureSegmentBends } = await import("../usePillDragHandlers");
    const corners = [{ x: 100, y: 50 }];
    const segments = [
      seg({ x: 0, y: 50 }, { x: 100, y: 50 }, 0),
      seg({ x: 100, y: 50 }, { x: 100, y: 200 }, null),
      seg({ x: 100, y: 200 }, { x: 300, y: 200 }, null),
    ];
    const r = ensureSegmentBends(corners, segments, 2);
    expect(r.live).toEqual([
      { x: 100, y: 50 },
      { x: 100, y: 200 },
      { x: 300, y: 200 },
    ]);
    expect([r.startIdx, r.endIdx]).toEqual([1, 2]);
  });

  it("an auto-routed edge's corners are path vertices: both ends already present, nothing inserted", async () => {
    const { ensureSegmentBends } = await import("../usePillDragHandlers");
    const corners = [
      { x: 262, y: 132 },
      { x: 485, y: 132 },
    ];
    const segments = [
      seg({ x: 250, y: 132 }, { x: 262, y: 132 }, null),
      seg({ x: 262, y: 132 }, { x: 485, y: 132 }, null),
      seg({ x: 485, y: 132 }, { x: 497, y: 132 }, null),
    ];
    const r = ensureSegmentBends(corners, segments, 1);
    expect(r.live).toEqual(corners);
    expect([r.startIdx, r.endIdx]).toEqual([0, 1]);
  });

  it("reuses existing bends when both ends are already waypoints", async () => {
    const { ensureSegmentBends } = await import("../usePillDragHandlers");
    const corners = [
      { x: 100, y: 50 },
      { x: 100, y: 200 },
    ];
    const segments = [
      seg({ x: 0, y: 50 }, { x: 100, y: 50 }, 0),
      seg({ x: 100, y: 50 }, { x: 100, y: 200 }, 1),
      seg({ x: 100, y: 200 }, { x: 300, y: 200 }, null),
    ];
    const r = ensureSegmentBends(corners, segments, 1);
    expect(r.live).toEqual(corners);
    expect([r.startIdx, r.endIdx]).toEqual([0, 1]);
  });
});
