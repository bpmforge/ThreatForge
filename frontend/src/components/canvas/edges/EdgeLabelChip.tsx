"use client";

import { cn } from "@/lib/utils";

interface EdgeLabelChipProps {
  sizeClass: string;
  securityPillVisible: boolean;
  selected?: boolean;
  canEdit: boolean;
  protocol: string | null;
  auth: { label: string; color: string } | null;
  label: string | undefined;
  missingSecurityHint: boolean;
  threatCount: number;
  onLabelDrag?: (flowPos: { x: number; y: number }) => void;
  onStartLabelDrag: (e: React.MouseEvent) => void;
}

export function EdgeLabelChip({
  sizeClass,
  securityPillVisible,
  selected,
  canEdit,
  protocol,
  auth,
  label,
  missingSecurityHint,
  threatCount,
  onLabelDrag,
  onStartLabelDrag,
}: EdgeLabelChipProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 font-medium shadow-sm transition-all",
        "bg-background/95 border border-border",
        sizeClass,
        securityPillVisible
          ? "px-2 py-0.5 rounded-full"
          : "px-2 py-1 rounded-md",
        selected && "ring-2 ring-blue-500",
        canEdit && "cursor-text",
      )}
    >
      {securityPillVisible && (
        <>
          {protocol && <span className="text-foreground">{protocol}</span>}
          {protocol && auth && <span className="opacity-40">·</span>}
          {auth && <span className={auth.color}>{auth.label}</span>}
        </>
      )}
      {label && (
        <>
          {securityPillVisible && <span className="opacity-30 mx-0.5">|</span>}
          <span className="max-w-[120px] truncate text-foreground">
            {label}
          </span>
        </>
      )}
      {missingSecurityHint && (
        <span className="text-[10px] text-muted-foreground/70 italic">
          set protocol →
        </span>
      )}
      {threatCount > 0 && (
        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">
          {threatCount}
        </span>
      )}
      {selected && onLabelDrag && (
        <span
          className="ml-0.5 opacity-40 hover:opacity-80 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={onStartLabelDrag}
          aria-label="Drag to reposition label"
          title="Drag to reposition"
        >
          ⠿
        </span>
      )}
    </div>
  );
}
