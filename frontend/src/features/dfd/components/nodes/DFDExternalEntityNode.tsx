"use client";

/**
 * DFDExternalEntityNode - External Entity node for Data Flow Diagrams
 *
 * Renders as a rectangle per DFD notation, representing actors/systems outside scope.
 */
import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { DFDExternalEntityNodeData } from "@/types/dfd-canvas";
import type { ExternalEntityType } from "@/features/dfd";

type DFDExternalEntityNodeType = Node<DFDExternalEntityNodeData, "dfd-entity">;

/** Icons for entity types */
const entityIcons: Record<ExternalEntityType, string> = {
  USER: "👤",
  SYSTEM: "🖥️",
  SERVICE: "⚙️",
};

/** Style classes for entity types */
const entityStyles: Record<ExternalEntityType, string> = {
  USER: "border-amber-400 bg-amber-50",
  SYSTEM: "border-slate-400 bg-slate-50",
  SERVICE: "border-cyan-400 bg-cyan-50",
};

function DFDExternalEntityNodeComponent({
  data,
  selected,
}: NodeProps<DFDExternalEntityNodeType>) {
  const icon = entityIcons[data.entityType] || "📦";
  const styleClass = entityStyles[data.entityType] || entityStyles.SYSTEM;

  return (
    <div
      className={cn(
        "min-w-[120px] px-4 py-3 border-2 shadow-sm transition-all",
        styleClass,
        selected && "ring-2 ring-amber-500 ring-offset-2",
      )}
    >
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-amber-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-amber-500 border-2 border-white"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="w-3 h-3 bg-amber-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-3 h-3 bg-amber-500 border-2 border-white"
      />

      {/* Node content */}
      <div className="flex items-center gap-2">
        <span className="text-xl" role="img" aria-label={data.entityType}>
          {icon}
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            {data.name}
          </span>
          <span className="text-xs text-muted-foreground capitalize">
            {data.entityType.toLowerCase()}
          </span>
        </div>
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

export const DFDExternalEntityNode = memo(DFDExternalEntityNodeComponent);
