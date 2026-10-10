"use client";

import { cn } from "@/lib/utils";
import type { ConnectionData } from "@/types/canvas";

interface EdgeLabelTooltipProps {
  data: ConnectionData | undefined;
  protocol: string | null;
  auth: { label: string; color: string } | null;
  encrypted: boolean;
  dataTypes: string[];
  threatCount: number;
  securityLevel: "high" | "medium" | "low" | "critical";
  canEdit: boolean;
}

export function EdgeLabelTooltip({
  data,
  protocol,
  auth,
  encrypted,
  dataTypes,
  threatCount,
  securityLevel,
  canEdit,
}: EdgeLabelTooltipProps) {
  return (
    <div
      className={cn(
        "absolute left-1/2 -translate-x-1/2 mt-2 z-50",
        "bg-background border rounded-lg shadow-lg p-3 min-w-[200px] text-xs",
      )}
    >
      {data?.label && (
        <div className="font-medium text-foreground mb-2">{data.label}</div>
      )}
      <div className="space-y-1.5 text-muted-foreground">
        <div className="flex justify-between">
          <span>Protocol:</span>
          <span className="font-medium text-foreground">
            {protocol ?? "Not set"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Authentication:</span>
          <span className={cn("font-medium", auth?.color ?? "text-foreground")}>
            {auth?.label ?? "Not set"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Encrypted:</span>
          <span
            className={cn(
              "font-medium",
              encrypted
                ? "text-green-700 dark:text-green-400"
                : "text-red-700 dark:text-red-400",
            )}
          >
            {encrypted ? "Yes" : "No"}
          </span>
        </div>
        {dataTypes.length > 0 && (
          <div className="flex justify-between">
            <span>Data:</span>
            <span className="font-medium text-foreground">
              {dataTypes.join(", ")}
            </span>
          </div>
        )}
        {threatCount > 0 && (
          <div className="flex justify-between">
            <span>Threats:</span>
            <span className="font-medium text-red-600">
              {threatCount} identified
            </span>
          </div>
        )}
        {data?.description && (
          <div className="pt-2 border-t mt-2">
            <p className="italic">{data.description}</p>
          </div>
        )}
      </div>
      <div className="mt-2 pt-2 border-t flex justify-center">
        <span
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
            securityLevel === "high" && "bg-green-500 text-white",
            securityLevel === "medium" && "bg-yellow-500 text-white",
            securityLevel === "low" && "bg-orange-500 text-white",
            securityLevel === "critical" && "bg-red-500 text-white",
          )}
        >
          {securityLevel} security
        </span>
      </div>
      {canEdit && (
        <p className="mt-2 text-[10px] text-muted-foreground/60 text-center">
          Double-click to edit label
        </p>
      )}
    </div>
  );
}
