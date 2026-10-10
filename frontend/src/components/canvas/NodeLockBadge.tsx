"use client";

import { Lock } from "lucide-react";

interface NodeLockBadgeProps {
  className?: string;
}

/** Small lock icon shown on locked nodes */
export function NodeLockBadge({ className }: NodeLockBadgeProps) {
  return (
    <div
      className={`absolute top-0.5 left-0.5 p-0.5 rounded bg-foreground/10 text-foreground/60 pointer-events-none ${className ?? ""}`}
      aria-label="Node is locked"
      title="Locked — unlock from toolbar or context menu"
    >
      <Lock className="h-2.5 w-2.5" />
    </div>
  );
}
