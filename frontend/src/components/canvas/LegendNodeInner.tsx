"use client";

/**
 * LegendNodeInner — presentational core of LegendNode.
 *
 * Pure: the live list of component types on the canvas arrives as the
 * `uniqueTypes` prop (the React Flow wrapper reads it from the Zustand store),
 * so the visual needs no React Flow context.
 */
import { componentConfigs, defaultConfig } from "./component-configs";
import type { ComponentType } from "@/types/canvas";

function formatTypeLabel(type: ComponentType): string {
  return type
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^aws /, "AWS ")
    .replace(/^gcp /, "GCP ")
    .replace(/^azure /, "Azure ");
}

export interface LegendNodeInnerProps {
  uniqueTypes: ComponentType[];
}

export function LegendNodeInner({ uniqueTypes }: LegendNodeInnerProps) {
  return (
    <div
      className="w-full h-full bg-background border rounded-lg shadow-sm overflow-hidden flex flex-col"
      aria-label="Diagram legend"
    >
      <div className="px-3 py-1.5 border-b bg-muted/40 flex items-center">
        <span className="text-xs font-semibold text-foreground tracking-wide uppercase">
          Legend
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1">
        {uniqueTypes.length === 0 ? (
          <p className="text-[10px] text-muted-foreground italic px-1">
            No components on canvas
          </p>
        ) : (
          uniqueTypes.map((type) => {
            const cfg = componentConfigs[type] ?? defaultConfig;
            const { Icon } = cfg;
            return (
              <div key={type} className="flex items-center gap-1.5 py-0.5">
                <div
                  className={`flex items-center justify-center w-5 h-5 rounded ${cfg.bgClass}`}
                >
                  <Icon className={`h-3 w-3 ${cfg.color}`} />
                </div>
                <span className="text-[10px] text-foreground capitalize truncate">
                  {formatTypeLabel(type)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
