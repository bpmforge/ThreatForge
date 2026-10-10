"use client";

/**
 * DFDProcessNode - Process node for Data Flow Diagrams
 *
 * Renders as a circle with process number and name (DFD notation).
 */
import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { DFDProcessNodeData } from "@/types/dfd-canvas";

type DFDProcessNodeType = Node<DFDProcessNodeData, "dfd-process">;

function DFDProcessNodeComponent({
  data,
  selected,
}: NodeProps<DFDProcessNodeType>) {
  return (
    <div
      className={cn(
        "flex items-center justify-center w-28 h-28 rounded-full border-2 bg-white shadow-sm transition-all",
        "border-blue-400",
        selected && "ring-2 ring-blue-500 ring-offset-2",
      )}
    >
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />

      {/* Node content */}
      <div className="flex flex-col items-center text-center px-2">
        <span className="text-xs font-bold text-blue-600 mb-1">
          {data.number}
        </span>
        <span className="text-sm font-medium text-foreground leading-tight line-clamp-2">
          {data.name}
        </span>
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

export const DFDProcessNode = memo(DFDProcessNodeComponent);
