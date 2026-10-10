/**
 * Segment dragging — grab anywhere on a segment, move only perpendicular.
 *
 * A horizontal segment may slide up/down and a vertical one left/right; moving
 * along its own axis is a no-op visually but drags the corner off the
 * neighbouring segment and bends the run. These cover the pure geometry the
 * drag handlers use.
 */
import { describe, it, expect } from "vitest";
import { constrainToSegment, waypointsOnSegment } from "./usePillDragHandlers";
import type { Segment } from "./path-segments";

const seg = (
  start: { x: number; y: number },
  end: { x: number; y: number },
  orientation: Segment["orientation"],
): Segment => ({
  start,
  end,
  orientation,
  midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
  waypointIndex: 0,
  manual: true,
});

describe("constrainToSegment", () => {
  const anchor = { x: 100, y: 50 };

  it("a horizontal segment moves ONLY vertically", () => {
    const s = seg({ x: 0, y: 50 }, { x: 200, y: 50 }, "horizontal");
    const out = constrainToSegment(s, { x: 999, y: 120 }, anchor);
    expect(out).toEqual({ x: 100, y: 120 }); // x pinned, y follows cursor
  });

  it("a vertical segment moves ONLY horizontally", () => {
    const s = seg({ x: 100, y: 0 }, { x: 100, y: 200 }, "vertical");
    const out = constrainToSegment(s, { x: 260, y: 999 }, anchor);
    expect(out).toEqual({ x: 260, y: 50 }); // y pinned, x follows cursor
  });

  it("leaves a curve unconstrained (pre-orthogonal fallback)", () => {
    const s = seg({ x: 0, y: 0 }, { x: 50, y: 50 }, "curve");
    expect(constrainToSegment(s, { x: 7, y: 9 }, anchor)).toEqual({
      x: 7,
      y: 9,
    });
  });
});

describe("waypointsOnSegment", () => {
  it("finds BOTH ends so the whole segment slides as one piece", () => {
    const corners = [
      { x: 100, y: 0 },
      { x: 100, y: 50 }, // segment start
      { x: 300, y: 50 }, // segment end
      { x: 300, y: 90 },
    ];
    const s = seg({ x: 100, y: 50 }, { x: 300, y: 50 }, "horizontal");
    expect(waypointsOnSegment(corners, s)).toEqual([1, 2]);
  });

  it("returns only the end that is a waypoint when the other is anchored", () => {
    // Segment running from the node anchor (not a waypoint) to a corner.
    const corners = [{ x: 300, y: 50 }];
    const s = seg({ x: 0, y: 50 }, { x: 300, y: 50 }, "horizontal");
    expect(waypointsOnSegment(corners, s)).toEqual([0]);
  });

  it("tolerates sub-pixel drift", () => {
    const corners = [{ x: 100.4, y: 49.7 }];
    const s = seg({ x: 100, y: 50 }, { x: 300, y: 50 }, "horizontal");
    expect(waypointsOnSegment(corners, s)).toEqual([0]);
  });

  it("ignores holes rather than throwing", () => {
    const corners: Array<{ x: number; y: number }> = [];
    corners[2] = { x: 300, y: 50 };
    const s = seg({ x: 100, y: 50 }, { x: 300, y: 50 }, "horizontal");
    expect(() => waypointsOnSegment(corners, s)).not.toThrow();
    expect(waypointsOnSegment(corners, s)).toEqual([2]);
  });
});
