"use client";

/**
 * QuickAddShapePicker — appears when a connection drag ends on empty canvas.
 * Shows the top-5 most-used component types + a "More…" overflow button.
 * Selecting a type creates the node AND the connecting edge atomically.
 */
import { useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { componentConfigs, defaultConfig } from "./component-configs";
import { getDefaultLabel } from "@/stores/canvas";
import type { ComponentType } from "@/types/canvas";
import type { QuickAddState } from "@/hooks/useQuickAdd";

interface QuickAddShapePickerProps {
  state: QuickAddState;
  top5: ComponentType[];
  onSelect: (
    type: ComponentType,
    flowPosition: { x: number; y: number },
  ) => void;
  onDismiss: () => void;
}
export function QuickAddShapePicker({
  state,
  top5,
  onSelect,
  onDismiss,
}: QuickAddShapePickerProps) {
  const { screenToFlowPosition } = useReactFlow();
  const ref = useRef<HTMLDivElement>(null);

  // Dismiss on Escape or click outside
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClickOutside);
    };
  }, [onDismiss]);

  const handleSelect = (type: ComponentType) => {
    // Offset the new node slightly below the drop point
    const flowPos = screenToFlowPosition({ x: state.x, y: state.y + 60 });
    onSelect(type, flowPos);
  };

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-background border border-border rounded-lg shadow-xl p-2 min-w-[200px]"
      style={{ left: state.x + 8, top: state.y + 8 }}
    >
      <p className="text-[10px] text-muted-foreground px-2 pb-1.5 font-medium uppercase tracking-wide">
        Add connected shape
      </p>
      <div className="space-y-0.5">
        {top5.map((type) => {
          const cfg = componentConfigs[type] ?? defaultConfig;
          const { Icon } = cfg;
          return (
            <button
              key={type}
              onClick={() => handleSelect(type)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-accent transition-colors"
              aria-label={`Add ${getDefaultLabel(type)}`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
              <span className="text-foreground">{getDefaultLabel(type)}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-1 pt-1 border-t">
        <button
          onClick={onDismiss}
          className="w-full px-2 py-1 text-xs text-muted-foreground hover:bg-accent rounded transition-colors text-left"
        >
          More… (open palette)
        </button>
      </div>
    </div>
  );
}
