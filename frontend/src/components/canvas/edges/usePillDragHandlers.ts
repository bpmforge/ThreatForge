import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import type { Segment, SegmentOrientation } from "./path-segments";

type Pt = { x: number; y: number };

interface TransientPill {
  x: number;
  y: number;
  orientation: SegmentOrientation;
  segIndex: number;
}

interface UsePillDragHandlersProps {
  corners: Pt[];
  /** Segments of the drawn path, in order — needed to place inserted bends. */
  segments: Segment[];
  /** Fixed ends of the edge — their axes are magnet targets for a dragged segment. */
  endpoints?: { source: Pt; target: Pt };
  transientPill?: TransientPill | null;
  onUpdate: (corners: Pt[]) => void;
  onCommit: (corners: Pt[]) => void;
  /** Insert one or more new waypoints at `insertIndex` (in path order). */
  onInsertWaypoint?: (insertIndex: number, positions: Pt[]) => void;
}

/**
 * How close (flow px) a dragged segment has to come to a neighbouring axis
 * before it snaps onto it. Half the 16px grid: the grid keeps a dragged
 * segment on multiples of 16 while node ports rarely are, so without a magnet
 * a segment could never land EXACTLY in line with its neighbours and the
 * redundant corner would never collapse.
 */
export const ALIGN_SNAP = 8;

/**
 * Snap `value` onto the nearest candidate within ALIGN_SNAP, else leave it.
 * This is what lets "drag a bend back into line" remove the bend: once the
 * moved coordinate equals its neighbour's, simplifyWaypoints drops the corner.
 */
export function magnet(value: number, candidates: number[]): number {
  let best = value;
  let bestDist = ALIGN_SNAP + 1;
  for (const c of candidates) {
    const d = Math.abs(c - value);
    if (d <= ALIGN_SNAP && d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}

/**
 * The two bends that move an auto-routed segment as ONE piece to the cursor:
 * its start and end, projected onto the cursor's perpendicular offset. One
 * bend at the cursor is not enough — orthogonalization then draws a spike
 * out to it and straight back, which the simplifier removes as collinear,
 * so a straight line could never be bent by dragging its middle.
 */
export function displacedSegment(seg: Segment, cursor: Pt): Pt[] {
  if (seg.orientation === "horizontal") {
    return [
      { x: seg.start.x, y: cursor.y },
      { x: seg.end.x, y: cursor.y },
    ];
  }
  if (seg.orientation === "vertical") {
    return [
      { x: cursor.x, y: seg.start.y },
      { x: cursor.x, y: seg.end.y },
    ];
  }
  return [cursor];
}

/**
 * Make sure BOTH ends of segment `i` are waypoints, inserting bends where an
 * end is the edge's endpoint or an auto-routed corner. Returns the working
 * list plus the indices of the two bends to move. Insertion keeps path order:
 * a bend goes right after the waypoints that precede this segment.
 *
 * Moving only the ends that already were waypoints (the old behaviour) let a
 * segment with a single bend pivot about its fixed end; orthogonalization
 * turned that into a spike and the simplifier removed it — the drag did
 * nothing visible.
 */
export function ensureSegmentBends(
  corners: Pt[],
  segments: Segment[],
  i: number,
): { live: Pt[]; startIdx: number; endIdx: number } {
  const seg = segments[i];
  const live = corners.map((c) => ({ ...c }));
  // Match by COORDINATE: `corners` is the waypoint list for a manually bent
  // edge but the drawn path's vertices for an auto-routed one, and only the
  // former carries waypointIndex. Coordinates work for both.
  const indexOf = (p: Pt) =>
    live.findIndex((c) => Math.abs(c.x - p.x) < 1 && Math.abs(c.y - p.y) < 1);
  const before = segments
    .slice(0, i)
    .filter((s) => indexOf(s.end) !== -1).length;
  let startIdx = indexOf(seg.start);
  let endIdx = indexOf(seg.end);
  if (startIdx === -1) {
    live.splice(before, 0, { ...seg.start });
    startIdx = before;
    if (endIdx !== -1 && endIdx >= before) endIdx += 1;
  }
  if (endIdx === -1) {
    live.splice(startIdx + 1, 0, { ...seg.end });
    endIdx = startIdx + 1;
  }
  return { live, startIdx, endIdx };
}

/**
 * A segment may only travel PERPENDICULAR to itself: a horizontal segment
 * slides up/down, a vertical one left/right. Dragging along its own axis would
 * just slide the line inside itself — no visible change, but it drags the
 * corner off the neighbouring segment and bends the run.
 */
export function constrainToSegment(seg: Segment, cursor: Pt, anchor: Pt): Pt {
  if (seg.orientation === "horizontal") return { x: anchor.x, y: cursor.y };
  if (seg.orientation === "vertical") return { x: cursor.x, y: anchor.y };
  return cursor; // diagonal/curve: unconstrained (pre-orthogonal fallback)
}

/**
 * Waypoint indices sitting on either end of this segment.
 *
 * Matched by COORDINATE rather than by arithmetic on waypointIndex: the drawn
 * path is simplified for display, so positions in the path and positions in the
 * waypoint list do not correspond one-to-one. Coordinate matching is what the
 * rest of the pipeline (extractSegments) already uses.
 */
export function waypointsOnSegment(corners: Pt[], seg: Segment): number[] {
  const hits: number[] = [];
  corners.forEach((c, i) => {
    if (!c) return;
    const onStart =
      Math.abs(c.x - seg.start.x) < 1 && Math.abs(c.y - seg.start.y) < 1;
    const onEnd =
      Math.abs(c.x - seg.end.x) < 1 && Math.abs(c.y - seg.end.y) < 1;
    if (onStart || onEnd) hits.push(i);
  });
  return hits;
}

export function usePillDragHandlers({
  corners,
  segments,
  endpoints,
  transientPill,
  onUpdate,
  onCommit,
  onInsertWaypoint,
}: UsePillDragHandlersProps) {
  const { screenToFlowPosition } = useReactFlow();

  const cursorFor = (seg: Segment) => {
    if (seg.orientation === "horizontal") return "ns-resize";
    if (seg.orientation === "vertical") return "ew-resize";
    return "move";
  };

  const startDrag = useCallback(
    (e: React.MouseEvent, seg: Segment, segIndex: number) => {
      e.stopPropagation();
      e.preventDefault();
      if (seg.orientation !== "horizontal" && seg.orientation !== "vertical")
        return;

      // Every segment drag moves the segment as ONE piece: both ends travel
      // with the cursor (bends are inserted for ends that were not waypoints
      // yet), so the segment slides parallel to itself and its neighbours
      // stretch — a U-jog, never a pivot.
      const { live, startIdx, endIdx } = ensureSegmentBends(
        corners,
        segments,
        segIndex,
      );
      const origin = live.map((c) => ({ ...c }));
      const moving = new Set([startIdx, endIdx]);
      // Axes the segment can snap onto: every point that is NOT moving —
      // the fixed ends of the edge and the other corners.
      const fixed: Pt[] = [
        ...(endpoints ? [endpoints.source, endpoints.target] : []),
        ...live.filter((_, i) => !moving.has(i)),
      ];
      const snapAxis = (cursor: Pt): Pt =>
        seg.orientation === "horizontal"
          ? {
              x: cursor.x,
              y: magnet(
                cursor.y,
                fixed.map((p) => p.y),
              ),
            }
          : {
              x: magnet(
                cursor.x,
                fixed.map((p) => p.x),
              ),
              y: cursor.y,
            };

      const apply = (ev: MouseEvent) => {
        const cursor = snapAxis(
          screenToFlowPosition({ x: ev.clientX, y: ev.clientY }),
        );
        for (const idx of moving) {
          live[idx] = constrainToSegment(seg, cursor, origin[idx]);
        }
      };
      const onMove = (ev: MouseEvent) => {
        apply(ev);
        onUpdate([...live]);
      };
      const onUp = (ev: MouseEvent) => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        apply(ev);
        onCommit([...live]);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [corners, segments, endpoints, screenToFlowPosition, onUpdate, onCommit],
  );

  const startTransientDrag = useCallback(
    (e: React.MouseEvent, seg?: Segment) => {
      if (!transientPill) return;
      e.stopPropagation();
      e.preventDefault();
      const { segIndex } = transientPill;
      // Grabbing a line at its quarter mark bends the part of the segment
      // from that point to its end: two bends again, so the run stays a
      // proper jog instead of a collapsing spike.
      const bends = (cursor: Pt): Pt[] => {
        if (!seg) return [cursor];
        const partial: Segment = {
          ...seg,
          start: { x: transientPill.x, y: transientPill.y },
          midpoint: seg.midpoint,
        };
        return [
          { x: transientPill.x, y: transientPill.y },
          ...displacedSegment(partial, cursor),
        ];
      };
      let inserted = bends(
        screenToFlowPosition({ x: e.clientX, y: e.clientY }),
      );
      const onMove = (ev: MouseEvent) => {
        inserted = bends(
          screenToFlowPosition({ x: ev.clientX, y: ev.clientY }),
        );
        const preview = [...corners];
        preview.splice(segIndex, 0, ...inserted);
        onUpdate(preview);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        if (onInsertWaypoint) {
          onInsertWaypoint(segIndex, inserted);
        } else {
          const next = [...corners];
          next.splice(segIndex, 0, ...inserted);
          onCommit(next);
        }
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [
      transientPill,
      corners,
      screenToFlowPosition,
      onUpdate,
      onCommit,
      onInsertWaypoint,
    ],
  );

  return { startDrag, startTransientDrag, cursorFor };
}
