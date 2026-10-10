"use client";

import { type RefObject } from "react";
import { cn } from "@/lib/utils";

interface EdgeLabelInlineEditProps {
  wrapperStyle: React.CSSProperties;
  inputRef: RefObject<HTMLInputElement | null>;
  editValue: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

export function EdgeLabelInlineEdit({
  wrapperStyle,
  inputRef,
  editValue,
  onChange,
  onCommit,
  onCancel,
}: EdgeLabelInlineEditProps) {
  return (
    <div
      className="absolute pointer-events-auto nodrag nopan"
      style={wrapperStyle}
    >
      <input
        ref={inputRef}
        value={editValue}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit();
          if (e.key === "Escape") onCancel();
          e.stopPropagation();
        }}
        className={cn(
          "text-xs px-2 py-1 rounded-md border border-blue-500 ring-2 ring-blue-200",
          "bg-background text-foreground shadow-sm outline-none",
          "min-w-[80px] max-w-[180px]",
        )}
        placeholder="Connection label…"
      />
    </div>
  );
}
