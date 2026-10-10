"use client";

/**
 * ComponentNodeInner — the presentational core of ComponentNode.
 *
 * Pure: driven entirely by plain props (no React Flow context, no Zustand
 * store). The RF wrapper (ComponentNode) renders this, so the visual lives in
 * one place. The RF-only chrome (Handle, NodeResizer, action toolbar,
 * quick-connect, rotate grip) stays in the RF wrapper around this inner.
 */
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ComponentNodeData } from "@/types/canvas";
import {
  getExpectedThreats,
  calculateCoverageStatus,
} from "@/features/threats/utils/coverage-calculator";
import { componentConfigs, defaultConfig } from "./component-configs";
import { NodeLockBadge } from "./NodeLockBadge";
import { NodeStatusChip } from "./NodeStatusChip";
import { RichLabel } from "./RichLabel";

const fontSizeClasses = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
} as const;

export interface ComponentNodeInnerProps {
  data: ComponentNodeData;
  selected?: boolean;
}

export function ComponentNodeInner({
  data,
  selected,
}: ComponentNodeInnerProps) {
  const config = componentConfigs[data.type] || defaultConfig;
  const { Icon } = config;
  const threatCount = data.threats?.length || 0;
  const unmitigatedCount =
    data.threats?.filter((t) => !t.mitigated).length || 0;

  const expectedThreats = getExpectedThreats(data.type);
  const coverageStatus = calculateCoverageStatus(threatCount, expectedThreats);

  const customStyle = data.style;
  const hasCustomColors =
    customStyle?.backgroundColor || customStyle?.borderColor;

  const inlineStyle = useMemo(() => {
    if (!hasCustomColors) return undefined;
    return {
      backgroundColor: customStyle?.backgroundColor,
      borderColor: customStyle?.borderColor,
      color: customStyle?.textColor,
    };
  }, [
    hasCustomColors,
    customStyle?.backgroundColor,
    customStyle?.borderColor,
    customStyle?.textColor,
  ]);

  const fontSizeClass = customStyle?.fontSize
    ? fontSizeClasses[customStyle.fontSize]
    : "text-sm";

  const typeLabel = (data.type || "component")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^aws /, "AWS ")
    .replace(/^gcp /, "GCP ")
    .replace(/^azure /, "Azure ");

  const accessibleDescription = useMemo(() => {
    const parts = [`${typeLabel} component: ${data.label}`];
    const coveragePercent = Math.round((threatCount / expectedThreats) * 100);
    parts.push(
      `${threatCount} of ${expectedThreats} expected threats, ${coveragePercent}% coverage, ${coverageStatus}`,
    );
    if (unmitigatedCount > 0) parts.push(`${unmitigatedCount} unmitigated`);
    if (data.trustLevel && data.trustLevel !== "INTERNAL")
      parts.push(`Trust level: ${data.trustLevel}`);
    return parts.join(". ");
  }, [
    typeLabel,
    data.label,
    threatCount,
    expectedThreats,
    coverageStatus,
    unmitigatedCount,
    data.trustLevel,
  ]);

  const rotation = customStyle?.rotation ?? 0;

  return (
    <div
      role="button"
      aria-label={accessibleDescription}
      aria-pressed={selected}
      tabIndex={0}
      className={cn(
        "px-4 py-3 rounded-lg border-2 shadow-sm min-w-[120px] h-full transition-colors duration-150",
        !hasCustomColors && config.bgClass,
        !hasCustomColors && config.borderClass,
        selected && "ring-2 ring-blue-500 ring-offset-2",
        data.highlighted && !selected && "ring-2 ring-yellow-400 ring-offset-2",
        data.chainHighlight === "entry" && "ring-2 ring-red-500 ring-offset-2",
        data.chainHighlight === "target" && "ring-2 ring-red-700 ring-offset-2",
        data.chainHighlight === "intermediate" &&
          "ring-2 ring-orange-400 ring-offset-2",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
      )}
      style={inlineStyle}
    >
      {data.locked && <NodeLockBadge />}

      <div
        className="flex items-center gap-2"
        style={
          rotation !== 0
            ? { transform: `rotate(${rotation}deg)`, transformOrigin: "center" }
            : undefined
        }
      >
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-md shrink-0",
            hasCustomColors ? "bg-black/5" : "bg-white/50",
          )}
        >
          {data.customIcon ? (
            <img
              src={data.customIcon}
              alt=""
              className="h-6 w-6 object-contain rounded-sm"
            />
          ) : (
            <Icon
              className={cn(
                "h-5 w-5",
                hasCustomColors ? undefined : config.color,
              )}
            />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          {data.richLabel ? (
            <RichLabel
              value={data.richLabel}
              className={cn(
                "font-medium",
                fontSizeClass,
                !hasCustomColors && config.textColor,
              )}
              style={
                hasCustomColors ? { color: customStyle?.textColor } : undefined
              }
            />
          ) : (
            <span
              className={cn(
                "font-medium truncate",
                fontSizeClass,
                !hasCustomColors && config.textColor,
              )}
              style={
                hasCustomColors ? { color: customStyle?.textColor } : undefined
              }
              title={data.label}
            >
              {data.label}
            </span>
          )}
          <span
            className={cn(
              "text-xs capitalize truncate",
              !hasCustomColors && config.textColorMuted,
            )}
          >
            {typeLabel}
          </span>
          {data.status && <NodeStatusChip status={data.status} />}
        </div>
      </div>

      {(threatCount > 0 || unmitigatedCount > 0) && (
        <div
          className={cn(
            "absolute -top-2 -right-2 px-1.5 h-5 rounded-full text-xs flex items-center justify-center font-medium",
            unmitigatedCount > 0
              ? "bg-amber-500 text-white"
              : "bg-green-500 text-white",
          )}
          title={`${threatCount} threat${threatCount !== 1 ? "s" : ""}${unmitigatedCount > 0 ? `, ${unmitigatedCount} unmitigated` : " (all mitigated)"}`}
        >
          {unmitigatedCount > 0 ? unmitigatedCount : threatCount}
        </div>
      )}

      {data.trustLevel && data.trustLevel !== "INTERNAL" && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-foreground text-background text-[10px] rounded">
          {data.trustLevel}
        </div>
      )}
    </div>
  );
}
