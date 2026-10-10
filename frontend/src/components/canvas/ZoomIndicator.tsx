"use client";

import { useStore, useReactFlow } from "@xyflow/react";
import { Button } from "@/components/ui/button";

/**
 * ZoomIndicator - Shows current zoom percentage, clickable to reset to 100%.
 * Mirrors the affordance found in Lucidchart / Figma / draw.io.
 */
export function ZoomIndicator() {
  const zoom = useStore((s) => s.transform[2]);
  const { zoomTo } = useReactFlow();
  const pct = Math.round(zoom * 100);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs font-medium tabular-nums"
      onClick={() => zoomTo(1, { duration: 200 })}
      title="Click to reset zoom to 100%"
    >
      {pct}%
    </Button>
  );
}
