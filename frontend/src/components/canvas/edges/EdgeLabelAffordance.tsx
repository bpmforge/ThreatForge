"use client";

import { cn } from "@/lib/utils";

interface EdgeLabelAffordanceProps {
  wrapperStyle: React.CSSProperties;
  onStartEdit: () => void;
}

export function EdgeLabelAffordance({
  wrapperStyle,
  onStartEdit,
}: EdgeLabelAffordanceProps) {
  return (
    <div
      className="absolute pointer-events-auto nodrag nopan"
      style={wrapperStyle}
    >
      <button
        className={cn(
          "text-[10px] text-muted-foreground/50 hover:text-muted-foreground",
          "px-1.5 py-0.5 rounded border border-dashed border-muted-foreground/30",
          "hover:border-muted-foreground/60 transition-colors cursor-text",
        )}
        onDoubleClick={onStartEdit}
        aria-label="Double-click to add a label"
      >
        + label
      </button>
    </div>
  );
}
