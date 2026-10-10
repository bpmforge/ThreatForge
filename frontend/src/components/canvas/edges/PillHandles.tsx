"use client";

import { usePillDragHandlers } from "./usePillDragHandlers";
import type { Segment, SegmentOrientation } from "./path-segments";

type Pt = { x: number; y: number };

interface TransientPill {
  x: number;
  y: number;
  orientation: SegmentOrientation;
  segIndex: number;
}

interface PillHandlesProps {
  segments: Segment[];
  corners: Pt[];
  endpoints?: { source: Pt; target: Pt };
  onDoubleClick?: () => void;
  transientPill?: TransientPill | null;
  onUpdate: (corners: Pt[]) => void;
  onCommit: (corners: Pt[]) => void;
  onInsertWaypoint?: (insertIndex: number, positions: Pt[]) => void;
}

const PILL_W = 12;
const PILL_H = 6;
const HIT_W = 16;
const HIT_H = 10;
/** Thickness of the full-length grab band along a segment. */
const BAND = 11;
/** Keep the band clear of the corner handles at each end. */
const BAND_INSET = 6;
const PILL_R = 3;

export function PillHandles({
  segments,
  corners,
  endpoints,
  onDoubleClick,
  transientPill,
  onUpdate,
  onCommit,
  onInsertWaypoint,
}: PillHandlesProps) {
  const { startDrag, startTransientDrag, cursorFor } = usePillDragHandlers({
    corners,
    segments,
    endpoints,
    transientPill,
    onUpdate,
    onCommit,
    onInsertWaypoint,
  });

  return (
    <>
      {segments.map((seg, i) => {
        const { x, y } = seg.midpoint;
        const cursor = cursorFor(seg);

        return (
          <g
            key={i}
            style={{ cursor, pointerEvents: "all" }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onDoubleClick?.();
            }}
          >
            {/*
              Grab band spanning the WHOLE segment, so the line can be dragged
              anywhere along it rather than only at the midpoint pill. Inset at
              both ends so it does not swallow the corner handles, and
              transparent — the pill remains the visible affordance.
            */}
            {(() => {
              const horizontal = seg.orientation === "horizontal";
              const vertical = seg.orientation === "vertical";
              if (!horizontal && !vertical) return null; // curve: pill only
              const lo = horizontal
                ? Math.min(seg.start.x, seg.end.x)
                : Math.min(seg.start.y, seg.end.y);
              const hi = horizontal
                ? Math.max(seg.start.x, seg.end.x)
                : Math.max(seg.start.y, seg.end.y);
              const span = hi - lo - BAND_INSET * 2;
              if (span <= 0) return null; // too short to grab safely
              return (
                <rect
                  x={horizontal ? lo + BAND_INSET : x - BAND / 2}
                  y={horizontal ? y - BAND / 2 : lo + BAND_INSET}
                  width={horizontal ? span : BAND}
                  height={horizontal ? BAND : span}
                  fill="transparent"
                  onMouseDown={(e) => startDrag(e, seg, i)}
                />
              );
            })()}
            <rect
              x={x - HIT_W / 2}
              y={y - HIT_H / 2}
              width={HIT_W}
              height={HIT_H}
              rx={PILL_R + 1}
              fill="transparent"
              onMouseDown={(e) => startDrag(e, seg, i)}
            />
            <rect
              x={x - PILL_W / 2}
              y={y - PILL_H / 2}
              width={PILL_W}
              height={PILL_H}
              rx={PILL_R}
              fill={seg.manual ? "#3b82f6" : "white"}
              stroke="#3b82f6"
              strokeWidth={1.5}
              style={{ pointerEvents: "none" }}
            />
          </g>
        );
      })}

      {segments.length > 0 &&
        [segments[0].start, segments[segments.length - 1].end].map((pt, i) => (
          <rect
            key={`ep-${i}`}
            x={pt.x - 4}
            y={pt.y - 4}
            width={8}
            height={8}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={1.5}
            style={{ pointerEvents: "none" }}
          />
        ))}

      {transientPill && (
        <g
          style={{
            cursor:
              transientPill.orientation === "horizontal"
                ? "ns-resize"
                : transientPill.orientation === "vertical"
                  ? "ew-resize"
                  : "copy",
            pointerEvents: "all",
          }}
        >
          <rect
            x={transientPill.x - HIT_W / 2}
            y={transientPill.y - HIT_H / 2}
            width={HIT_W}
            height={HIT_H}
            rx={PILL_R + 1}
            fill="transparent"
            onMouseDown={(e) =>
              startTransientDrag(e, segments[transientPill.segIndex])
            }
          />
          <rect
            x={transientPill.x - PILL_W / 2}
            y={transientPill.y - PILL_H / 2}
            width={PILL_W}
            height={PILL_H}
            rx={PILL_R}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={1.5}
            strokeDasharray="2,2"
            style={{ pointerEvents: "none" }}
          />
        </g>
      )}
    </>
  );
}
