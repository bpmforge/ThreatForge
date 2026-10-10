"use client";

/**
 * DFDFlowEdge - Data Flow edge for Data Flow Diagrams
 *
 * Renders as a labeled arrow showing data flow direction and type.
 */
import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { DFDDataFlowEdgeData } from "@/types/dfd-canvas";

type DFDFlowEdgeType = Edge<DFDDataFlowEdgeData>;

/** Badge colors for data types */
const dataTypeBadgeColors: Record<string, string> = {
  PII: "bg-red-100 text-red-700 border-red-200",
  PHI: "bg-red-100 text-red-700 border-red-200",
  FINANCIAL: "bg-amber-100 text-amber-700 border-amber-200",
  CREDENTIALS: "bg-purple-100 text-purple-700 border-purple-200",
  INTERNAL: "bg-blue-100 text-blue-700 border-blue-200",
  PUBLIC: "bg-green-100 text-green-700 border-green-200",
  CUSTOM: "bg-slate-100 text-slate-700 border-slate-200",
};

function DFDFlowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<DFDFlowEdgeType>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? "#3b82f6" : "#64748b",
          strokeWidth: selected ? 2.5 : 2,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          className={cn(
            "bg-white border rounded-md px-2 py-1 shadow-sm",
            selected ? "border-blue-400" : "border-slate-200",
          )}
        >
          <div className="flex flex-col items-center gap-0.5">
            {data?.number && (
              <span className="text-[10px] font-mono text-muted-foreground">
                {data.number}
              </span>
            )}
            <span className="text-xs font-medium text-foreground">
              {data?.name || "Data Flow"}
            </span>
            {data?.dataTypes && data.dataTypes.length > 0 && (
              <div className="flex flex-wrap gap-0.5 justify-center max-w-[120px]">
                {data.dataTypes.slice(0, 2).map((type) => (
                  <span
                    key={type}
                    className={cn(
                      "text-[9px] px-1 py-0.5 rounded border",
                      dataTypeBadgeColors[type] || dataTypeBadgeColors.CUSTOM,
                    )}
                  >
                    {type}
                  </span>
                ))}
                {data.dataTypes.length > 2 && (
                  <span className="text-[9px] px-1 py-0.5 rounded border bg-slate-50 text-slate-500 border-slate-200">
                    +{data.dataTypes.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const DFDFlowEdge = memo(DFDFlowEdgeComponent);
