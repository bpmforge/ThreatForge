"use client";

/**
 * PaletteItem - Draggable palette item component.
 * On touch devices, first tap selects for placement; second tap (on canvas) places.
 * On desktop, click immediately places at a staggered grid position.
 */

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/stores/canvas";
import { useUIStore } from "@/stores/ui-store";
import type { PaletteItem } from "../types";

interface PaletteItemComponentProps {
  item: PaletteItem;
}

export function PaletteItemComponent({ item }: PaletteItemComponentProps) {
  const addComponent = useCanvasStore((s) => s.addComponent);
  const nodeCount = useCanvasStore((s) => s.nodes.length);
  const pendingPaletteType = useUIStore((s) => s.pendingPaletteType);
  const setPendingPaletteType = useUIStore((s) => s.setPendingPaletteType);

  const isSelected = pendingPaletteType === item.type;

  const handleDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "component", componentType: item.type }),
    );
    event.dataTransfer.effectAllowed = "move";
  };

  const handleAdd = useCallback(() => {
    const col = nodeCount % 5;
    const row = Math.floor(nodeCount / 5);
    addComponent(item.type, { x: 120 + col * 240, y: 120 + row * 180 });
  }, [addComponent, item.type, nodeCount]);

  const handleClick = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      // Touch devices: toggle pending placement mode
      if (window.matchMedia("(pointer: coarse)").matches) {
        e.preventDefault();
        setPendingPaletteType(isSelected ? null : item.type);
        return;
      }
      // Desktop: immediate placement
      handleAdd();
    },
    [handleAdd, isSelected, item.type, setPendingPaletteType],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd],
  );

  return (
    <div
      draggable
      tabIndex={0}
      role="button"
      aria-label={`Add ${item.label} component`}
      aria-pressed={isSelected}
      onDragStart={handleDragStart}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex items-center gap-2.5 p-2 rounded-lg cursor-grab",
        "hover:bg-muted active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "transition-colors duration-150 group",
        isSelected && "bg-primary/10 ring-2 ring-primary/40",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-md",
          "bg-muted/50 group-hover:bg-background",
          "transition-colors",
          isSelected && "bg-primary/20",
        )}
      >
        <item.Icon className={cn("h-4 w-4", item.color || "text-foreground")} />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-medium text-foreground truncate">
          {item.label}
        </span>
        <span className="text-[11px] text-muted-foreground truncate">
          {isSelected ? "Tap canvas to place" : item.description}
        </span>
      </div>
    </div>
  );
}
