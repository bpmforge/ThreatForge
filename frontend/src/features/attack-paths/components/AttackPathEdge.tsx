"use client";

import {
  type EdgeProps,
  type Edge,
  getBezierPath,
  EdgeLabelRenderer,
} from "@xyflow/react";
import { cn } from "@/lib/utils";

const LIKELIHOOD_BG: Record<string, string> = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-orange-500",
  LOW: "bg-gray-500",
};

interface AttackPathEdgeData extends Record<string, unknown> {
  likelihood?: "HIGH" | "MEDIUM" | "LOW";
  label?: string;
}

type AttackPathEdgeType = Edge<AttackPathEdgeData, "attackPathEdge">;

export function AttackPathEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps<AttackPathEdgeType>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const strokeColor =
    data?.likelihood === "HIGH"
      ? "#ef4444"
      : data?.likelihood === "MEDIUM"
        ? "#f97316"
        : "#94a3b8";

  return (
    <>
      <path
        id={id}
        d={edgePath}
        className="stroke-2 fill-none"
        style={{ stroke: strokeColor }}
        markerEnd="url(#arrow)"
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
        >
          <div
            className={cn(
              "text-xs font-bold px-2 py-1 rounded text-white",
              LIKELIHOOD_BG[data?.likelihood || "LOW"],
            )}
          >
            {data?.label || data?.likelihood || ""}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
