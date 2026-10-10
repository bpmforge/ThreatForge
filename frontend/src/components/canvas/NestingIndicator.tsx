"use client";

import { Layers } from "lucide-react";

interface NestingIndicatorProps {
  depth: number;
}

export function NestingIndicator({ depth }: NestingIndicatorProps) {
  if (depth <= 1) return null;

  return (
    <span
      title={`Nesting level ${depth}`}
      className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground font-medium"
    >
      <Layers className="h-3 w-3 mr-0.5" />
      {depth}
    </span>
  );
}
