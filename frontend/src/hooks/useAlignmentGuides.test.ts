/**
 * useAlignmentGuides — computeSnapOffsets unit tests
 *
 * Pure function; no DOM required.
 */
import { describe, it, expect } from "vitest";
import { computeSnapOffsets } from "./useAlignmentGuides";
import type { CanvasNode } from "@/stores/canvas";

function makeNode(
  id: string,
  x: number,
  y: number,
  w = 160,
  h = 60,
  type: string = "component",
): CanvasNode {
  return {
    id,
    type,
    position: { x, y },
    measured: { width: w, height: h },
    data: {},
  } as unknown as CanvasNode;
}

describe("computeSnapOffsets", () => {
  it("returns null when no sibling nodes exist", () => {
    const dragging = makeNode("a", 100, 100);
    const { snapX, snapY } = computeSnapOffsets(dragging, [dragging]);
    expect(snapX).toBeNull();
    expect(snapY).toBeNull();
  });

  it("snaps left edge to sibling left edge (exact match)", () => {
    const dragging = makeNode("a", 200, 50);
    const sibling = makeNode("b", 200, 200);
    const { snapX, snapY } = computeSnapOffsets(dragging, [dragging, sibling]);
    expect(snapX).toBe(0); // left 200 === left 200 → delta 0
    expect(snapY).toBeNull();
  });

  it("snaps within threshold (delta <= 8)", () => {
    const dragging = makeNode("a", 198, 50); // left at 198
    const sibling = makeNode("b", 204, 200); // left at 204 → delta 6
    const { snapX } = computeSnapOffsets(dragging, [dragging, sibling]);
    expect(snapX).toBe(6);
  });

  it("does not snap outside threshold (delta > 8)", () => {
    const dragging = makeNode("a", 100, 50);
    const sibling = makeNode("b", 115, 200); // left delta 15 > 8
    const { snapX } = computeSnapOffsets(dragging, [dragging, sibling]);
    expect(snapX).toBeNull();
  });

  it("snaps right edge to right edge", () => {
    // dragging right = 100 + 160 = 260; sibling right = 100 + 160 = 260
    const dragging = makeNode("a", 100, 50);
    const sibling = makeNode("b", 100, 200);
    const { snapX } = computeSnapOffsets(dragging, [dragging, sibling]);
    expect(snapX).toBe(0);
  });

  it("snaps center-X to sibling center-X", () => {
    // dragging center = 100 + 80 = 180; sibling center = 108 + 80 = 188 → delta 8 (at threshold)
    const dragging = makeNode("a", 100, 50);
    const sibling = makeNode("b", 108, 200);
    const { snapX } = computeSnapOffsets(dragging, [dragging, sibling]);
    expect(snapX).toBe(8);
  });

  it("snaps top-Y to sibling top-Y", () => {
    const dragging = makeNode("a", 50, 104); // top 104
    const sibling = makeNode("b", 200, 100); // top 100 → delta -4
    const { snapY } = computeSnapOffsets(dragging, [dragging, sibling]);
    expect(snapY).toBe(-4);
  });

  it("snaps bottom to top (stacking)", () => {
    // dragging bottom = 100 + 60 = 160; sibling top = 163 → delta 3
    const dragging = makeNode("a", 50, 100);
    const sibling = makeNode("b", 200, 163);
    const { snapY } = computeSnapOffsets(dragging, [dragging, sibling]);
    expect(snapY).toBe(3);
  });

  it("skips boundary-type nodes", () => {
    const dragging = makeNode("a", 100, 50);
    const boundary = makeNode("b", 102, 200, 300, 200, "boundary");
    const { snapX } = computeSnapOffsets(dragging, [dragging, boundary]);
    expect(snapX).toBeNull();
  });

  it("picks closest snap when multiple candidates", () => {
    const dragging = makeNode("a", 100, 50);
    // sibling1 left at 103 → delta 3
    // sibling2 left at 107 → delta 7
    const s1 = makeNode("s1", 103, 300);
    const s2 = makeNode("s2", 107, 400);
    const { snapX } = computeSnapOffsets(dragging, [dragging, s1, s2]);
    expect(snapX).toBe(3); // closer
  });

  it("ignores self", () => {
    const dragging = makeNode("a", 100, 100);
    const { snapX, snapY } = computeSnapOffsets(dragging, [dragging]);
    expect(snapX).toBeNull();
    expect(snapY).toBeNull();
  });

  it("snaps both axes independently", () => {
    const dragging = makeNode("a", 200, 150);
    const sibling = makeNode("b", 203, 153); // delta X=3, delta Y=3
    const { snapX, snapY } = computeSnapOffsets(dragging, [dragging, sibling]);
    expect(snapX).toBe(3);
    expect(snapY).toBe(3);
  });
});
