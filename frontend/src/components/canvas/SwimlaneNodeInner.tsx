"use client";

/**
 * SwimlaneNodeInner — presentational core of SwimlaneNode.
 *
 * Pure: child count arrives as a prop (the React Flow wrapper reads it from the
 * store, and keeps the NodeResizer). No React Flow context.
 */
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { SwimlaneNodeData } from "@/types/canvas";

export const SWIMLANE_HEADER_HEIGHT = 32;
export const SWIMLANE_MIN_LANE_WIDTH = 80;

const LANE_COLORS = [
  "rgba(96, 165, 250, 0.08)",
  "rgba(167, 139, 250, 0.08)",
  "rgba(52, 211, 153, 0.08)",
  "rgba(251, 191, 36, 0.08)",
  "rgba(248, 113, 113, 0.08)",
  "rgba(156, 163, 175, 0.08)",
];

export interface SwimlaneNodeInnerProps {
  data: SwimlaneNodeData;
  selected?: boolean;
  childCount: number;
}

export function SwimlaneNodeInner({
  data,
  selected,
  childCount,
}: SwimlaneNodeInnerProps) {
  const lanes = useMemo(
    () =>
      data.lanes?.length
        ? data.lanes
        : [
            { id: "lane-1", name: "Lane 1" },
            { id: "lane-2", name: "Lane 2" },
          ],
    [data.lanes],
  );

  return (
    <div
      className={cn(
        "h-full w-full flex flex-col rounded-md overflow-hidden",
        "border-2 transition-colors",
        selected
          ? "border-violet-500/70"
          : "border-slate-400/40 dark:border-slate-600/40",
      )}
      style={{ background: "transparent" }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-3 shrink-0 select-none"
        style={{
          height: SWIMLANE_HEADER_HEIGHT,
          background:
            "linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(96,165,250,0.14) 100%)",
          borderBottom: "1px solid rgba(148,163,184,0.25)",
        }}
      >
        <span className="text-xs font-semibold text-foreground/80 truncate">
          {data.label || "Swimlane"}
        </span>
        {childCount > 0 && (
          <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
            {childCount} node{childCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Lane columns */}
      <div className="flex flex-1 overflow-hidden">
        {lanes.map((lane, idx) => (
          <div
            key={lane.id}
            className="flex-1 flex flex-col min-w-0"
            style={{
              background: lane.color || LANE_COLORS[idx % LANE_COLORS.length],
              borderRight:
                idx < lanes.length - 1
                  ? "1px dashed rgba(148,163,184,0.30)"
                  : "none",
            }}
          >
            {/* Lane label */}
            <div
              className="px-2 py-1 text-[10px] font-medium text-muted-foreground/70 select-none truncate"
              style={{
                borderBottom: "1px solid rgba(148,163,184,0.18)",
              }}
            >
              {lane.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
