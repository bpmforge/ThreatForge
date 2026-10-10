"use client";

/**
 * DFDPalette - Drag-and-drop palette for DFD elements
 */
import { cn } from "@/lib/utils";
import type { ExternalEntityType } from "@/features/dfd";

/** Palette item configuration */
interface PaletteItem {
  type: "dfd-process" | "dfd-datastore" | "dfd-entity";
  entityType?: ExternalEntityType;
  label: string;
  description: string;
  icon: string;
  colorClass: string;
}

const paletteItems: PaletteItem[] = [
  {
    type: "dfd-process",
    label: "Process",
    description: "A transformation of data",
    icon: "⚙️",
    colorClass: "bg-blue-50 border-blue-300 hover:border-blue-400",
  },
  {
    type: "dfd-datastore",
    label: "Data Store",
    description: "Persistent data storage",
    icon: "🗄️",
    colorClass: "bg-purple-50 border-purple-300 hover:border-purple-400",
  },
  {
    type: "dfd-entity",
    entityType: "USER",
    label: "User",
    description: "External user or actor",
    icon: "👤",
    colorClass: "bg-amber-50 border-amber-300 hover:border-amber-400",
  },
  {
    type: "dfd-entity",
    entityType: "SYSTEM",
    label: "System",
    description: "External system",
    icon: "🖥️",
    colorClass: "bg-slate-50 border-slate-300 hover:border-slate-400",
  },
  {
    type: "dfd-entity",
    entityType: "SERVICE",
    label: "Service",
    description: "External service",
    icon: "⚡",
    colorClass: "bg-cyan-50 border-cyan-300 hover:border-cyan-400",
  },
];

interface DFDPaletteProps {
  className?: string;
}

export function DFDPalette({ className }: DFDPaletteProps) {
  const handleDragStart = (event: React.DragEvent, item: PaletteItem) => {
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        type: item.type,
        entityType: item.entityType,
      }),
    );
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className={cn("w-64 bg-background border-r p-4", className)}>
      <h3 className="font-semibold text-sm text-foreground mb-1">
        DFD Elements
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Drag elements onto the canvas
      </p>

      <div className="space-y-2">
        {paletteItems.map((item) => (
          <div
            key={`${item.type}-${item.entityType || ""}`}
            draggable
            onDragStart={(e) => handleDragStart(e, item)}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border-2 cursor-grab transition-colors",
              item.colorClass,
              "active:cursor-grabbing",
            )}
          >
            <span className="text-2xl" role="img" aria-label={item.label}>
              {item.icon}
            </span>
            <div>
              <div className="font-medium text-sm text-foreground">
                {item.label}
              </div>
              <div className="text-xs text-muted-foreground">
                {item.description}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t">
        <h4 className="font-medium text-xs text-muted-foreground mb-2">Tips</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Connect elements by dragging from handles</li>
          <li>• Double-click to edit labels</li>
          <li>• Select and press Delete to remove</li>
          <li>• Use scroll to pan, pinch to zoom</li>
        </ul>
      </div>
    </div>
  );
}
