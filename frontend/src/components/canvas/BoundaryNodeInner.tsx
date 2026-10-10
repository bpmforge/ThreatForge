"use client";

/**
 * BoundaryNodeInner — presentational core of BoundaryNode.
 *
 * Pure: no React Flow context, no Zustand store. Store-derived values
 * (childCount, nestingDepth, collapse state + toggle) arrive as props from the
 * React Flow wrapper, which also keeps the NodeResizer.
 */
import { useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { NestingIndicator } from "./NestingIndicator";
import { NodeLockBadge } from "./NodeLockBadge";
import type { BoundaryNodeData, TrustLevel } from "@/types/canvas";

/** Border colors for trust levels */
const trustLevelStyles: Record<TrustLevel, { border: string; bg: string }> = {
  PUBLIC: { border: "#4ade80", bg: "rgba(74, 222, 128, 0.15)" },
  INTERNAL: { border: "#60a5fa", bg: "rgba(96, 165, 250, 0.15)" },
  CONFIDENTIAL: { border: "#fbbf24", bg: "rgba(251, 191, 36, 0.15)" },
  RESTRICTED: { border: "#f87171", bg: "rgba(248, 113, 113, 0.15)" },
};

export interface BoundaryNodeInnerProps {
  data: BoundaryNodeData;
  selected?: boolean;
  childCount: number;
  nestingDepth: number;
  onToggleCollapse?: (e: React.MouseEvent) => void;
}

export function BoundaryNodeInner({
  data,
  selected,
  childCount,
  nestingDepth,
  onToggleCollapse,
}: BoundaryNodeInnerProps) {
  const style = trustLevelStyles[data.trustLevel] || trustLevelStyles.INTERNAL;
  const opacity = data.opacity ?? 30;
  const opacityDecimal = opacity / 100;
  const isCollapsed = data.collapsed ?? false;

  const bgColor = useMemo(() => {
    const baseColor = style.bg.replace(/[\d.]+\)$/, `${opacityDecimal})`);
    return baseColor;
  }, [style.bg, opacityDecimal]);

  const accessibleDescription = useMemo(() => {
    const parts = [
      `Trust boundary: ${data.label}`,
      `Trust level: ${data.trustLevel}`,
    ];
    if (childCount > 0) {
      parts.push(
        `Contains ${childCount} component${childCount !== 1 ? "s" : ""}`,
      );
    } else {
      parts.push("Empty, drag components here");
    }
    if (data.description) {
      parts.push(data.description);
    }
    return parts.join(". ");
  }, [data.label, data.trustLevel, data.description, childCount]);

  return (
    <div
      role="group"
      aria-label={accessibleDescription}
      className={cn(
        "rounded-xl border-2 border-dashed p-2",
        isCollapsed ? "w-fit h-fit" : "w-full h-full",
        selected && "ring-2 ring-blue-500 ring-offset-2",
      )}
      style={{
        borderColor: style.border,
        backgroundColor: isCollapsed ? "transparent" : bgColor,
        pointerEvents: "none",
      }}
    >
      {/* Boundary header */}
      {/* Drag handle. Selection and focus belong to the React Flow node
          wrapper; a role="button" here nested the collapse button inside
          another interactive control (axe nested-interactive). */}
      <div
        title={data.description || undefined}
        className="flex items-center gap-2 px-2 py-1 bg-background/90 rounded-lg w-fit shadow-sm cursor-move focus:outline-none focus:ring-2 focus:ring-blue-500"
        style={{ pointerEvents: "auto" }}
      >
        {/* Collapse toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? "Expand boundary" : "Collapse boundary"}
          aria-expanded={!isCollapsed}
          className="p-0 hover:text-foreground text-muted-foreground transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
        <span className="font-medium text-sm text-foreground">
          {data.label}
        </span>
        <span
          className={cn(
            "px-1.5 py-0.5 text-[10px] rounded font-medium",
            data.trustLevel === "PUBLIC" && "bg-green-100 text-green-700",
            data.trustLevel === "INTERNAL" && "bg-blue-100 text-blue-700",
            data.trustLevel === "CONFIDENTIAL" && "bg-amber-100 text-amber-700",
            data.trustLevel === "RESTRICTED" && "bg-red-100 text-red-700",
          )}
          aria-label={`Trust level: ${data.trustLevel}`}
        >
          {data.trustLevel}
        </span>
        {data.locked && <NodeLockBadge className="relative static p-0" />}
        {childCount > 0 && (
          <span
            className="px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground font-medium"
            aria-label={`${childCount} component${childCount !== 1 ? "s" : ""} inside`}
          >
            {isCollapsed ? `${childCount} hidden` : childCount}
          </span>
        )}
        <NestingIndicator depth={nestingDepth} />
      </div>

      {!isCollapsed && childCount === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs text-muted-foreground italic opacity-60">
            Drag components here
          </span>
        </div>
      )}
    </div>
  );
}
