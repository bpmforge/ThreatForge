"use client";

/**
 * WaypointHandles — draggable bend-point handles for SecurityEdge: hollow
 * pill handles at the midpoint of every straight segment. Dragging a pill on
 * an auto-routed segment inserts a new waypoint; dragging on a manual segment
 * moves the existing waypoint.
 */
import type { Segment, SegmentOrientation } from "./path-segments";
import { PillHandles } from "./PillHandles";

type Pt = { x: number; y: number };

interface TransientPill {
  x: number;
  y: number;
  orientation: SegmentOrientation;
  segIndex: number;
}

interface WaypointHandlesProps {
  /** Current bend-point corners */
  corners: Pt[];
  /** Segments extracted from the edge path */
  segments: Segment[];
  /** Fixed ends of the edge; magnet targets so a dragged bend can collapse */
  endpoints?: { source: Pt; target: Pt };
  /**
   * Double-click on a segment. The grab bands sit ABOVE the edge's hit path
   * once it is selected, so the line's own double-click never fires then.
   */
  onDoubleClick?: () => void;
  /** Quarter-mark hover pill from SecurityEdge mouse tracking */
  transientPill?: TransientPill | null;
  /** Called on every mousemove during drag — for live preview */
  onUpdate: (corners: Pt[]) => void;
  /** Called on mouseup — commit final position to store */
  onCommit: (corners: Pt[]) => void;
  /** Called when a pill drag on an auto-routed segment should insert a waypoint */
  onInsertWaypoint?: (insertIndex: number, positions: Pt[]) => void;
}

export function WaypointHandles(props: WaypointHandlesProps) {
  if (props.segments.length === 0) return null;
  return (
    <PillHandles
      segments={props.segments}
      corners={props.corners}
      endpoints={props.endpoints}
      onDoubleClick={props.onDoubleClick}
      transientPill={props.transientPill}
      onUpdate={props.onUpdate}
      onCommit={props.onCommit}
      onInsertWaypoint={props.onInsertWaypoint}
    />
  );
}
