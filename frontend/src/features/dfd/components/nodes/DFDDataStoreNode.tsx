"use client";

/**
 * DFDDataStoreNode - Data Store node for Data Flow Diagrams
 *
 * Renders as open-ended rectangle (two parallel lines) per DFD notation.
 */
import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { DFDDataStoreNodeData } from "@/types/dfd-canvas";

type DFDDataStoreNodeType = Node<DFDDataStoreNodeData, "dfd-datastore">;

/** Badge colors for data types */
const dataTypeBadgeColors: Record<string, string> = {
  PII: "bg-red-100 text-red-700",
  PHI: "bg-red-100 text-red-700",
  FINANCIAL: "bg-amber-100 text-amber-700",
  CREDENTIALS: "bg-purple-100 text-purple-700",
  INTERNAL: "bg-blue-100 text-blue-700",
  PUBLIC: "bg-green-100 text-green-700",
  CUSTOM: "bg-slate-100 text-slate-700",
};

function DFDDataStoreNodeComponent({
  data,
  selected,
}: NodeProps<DFDDataStoreNodeType>) {
  return (
    <div
      className={cn(
        "relative min-w-[140px] transition-all",
        selected && "ring-2 ring-purple-500 ring-offset-2 rounded",
      )}
    >
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-purple-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-purple-500 border-2 border-white"
      />

      {/* Data store shape - two parallel lines with content between */}
      <div className="border-t-2 border-b-2 border-purple-400 bg-white py-3 px-4">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-purple-600">
            {data.number}
          </span>
          <span className="text-sm font-medium text-foreground">
            {data.name}
          </span>
        </div>

        {/* Data type badges */}
        {data.dataTypes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {data.dataTypes.slice(0, 3).map((type) => (
              <span
                key={type}
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded",
                  dataTypeBadgeColors[type] || dataTypeBadgeColors.CUSTOM,
                )}
              >
                {type}
              </span>
            ))}
            {data.dataTypes.length > 3 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                +{data.dataTypes.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Linked indicator */}
      {data.linkedComponentId && (
        <div
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"
          title="Linked to threat model component"
        >
          <span className="text-white text-[10px]">L</span>
        </div>
      )}
    </div>
  );
}

export const DFDDataStoreNode = memo(DFDDataStoreNodeComponent);
