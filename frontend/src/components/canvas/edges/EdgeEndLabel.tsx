"use client";

/**
 * EdgeEndLabel — a small text label near one END of a line (draw.io's
 * source/target labels; Lucid's "text near the arrowhead"). Used for
 * cardinality, port names, "request"/"response", etc.
 *
 * Double-click the chip (or the line near that end) to edit inline. Hidden
 * when empty unless the line is selected, where it shows a faint "+" hint.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type EndLabelSlot = "start" | "end";

/** Where along the line (0..1) each end label sits. */
export const END_LABEL_T: Record<EndLabelSlot, number> = {
  start: 0.12,
  end: 0.88,
};

/**
 * Which label a double-click at position `t` along the line addresses:
 * near the ends → that end label, otherwise the mid label.
 */
export function endLabelSlot(t: number): EndLabelSlot | "mid" {
  if (t <= 0.2) return "start";
  if (t >= 0.8) return "end";
  return "mid";
}

interface EdgeEndLabelProps {
  x: number;
  y: number;
  value: string | undefined;
  selected: boolean;
  /** Increment to open the editor from outside (double-click on the line). */
  editRequest?: number;
  onChange: (value: string) => void;
}

export function EdgeEndLabel({
  x,
  y,
  value,
  selected,
  editRequest,
  onChange,
}: EdgeEndLabelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editRequest) {
      setDraft(value ?? "");
      setEditing(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRequest]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    if (next !== (value ?? "")) onChange(next);
    setEditing(false);
  };

  const style = {
    transform: `translate(-50%, -50%) translate(${x}px, ${y - 12}px)`,
  };

  if (editing) {
    return (
      <div className="absolute pointer-events-auto nodrag nopan" style={style}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="h-5 w-24 rounded border border-blue-400 bg-background px-1 text-[10px] outline-none"
          placeholder="end label"
        />
      </div>
    );
  }

  if (!value && !selected) return null;

  return (
    <div
      className="absolute pointer-events-auto nodrag nopan"
      style={style}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setDraft(value ?? "");
        setEditing(true);
      }}
      title="Double-click to edit end label"
    >
      <span
        className={cn(
          "rounded px-1 text-[10px] leading-4",
          value
            ? "bg-background/90 text-foreground border border-border shadow-sm"
            : "text-muted-foreground/60 border border-dashed border-muted-foreground/40",
        )}
      >
        {value || "+"}
      </span>
    </div>
  );
}
