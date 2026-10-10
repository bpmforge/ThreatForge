"use client";

/**
 * BoundaryItem - Draggable trust boundary item.
 */

import { Square } from "lucide-react";
import { cn } from "@/lib/utils";

export function BoundaryItem() {
  const handleDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "boundary" }),
    );
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={cn(
        "flex items-center gap-2.5 p-2 rounded-lg cursor-grab",
        "hover:bg-muted active:cursor-grabbing",
        "border-2 border-dashed border-muted-foreground/30",
        "transition-colors duration-150 group",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-md",
          "bg-muted/50 group-hover:bg-background",
          "transition-colors",
        )}
      >
        <Square className="h-4 w-4 text-blue-500" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-foreground">
          Trust Boundary
        </span>
        <span className="text-[11px] text-muted-foreground">
          Group components
        </span>
      </div>
    </div>
  );
}
