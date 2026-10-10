"use client";

/**
 * ThreatPanelFooter - Summary stats for the threat panel.
 */
import type { Threat } from "../types";

interface ThreatPanelFooterProps {
  threats: Threat[];
}

export function ThreatPanelFooter({ threats }: ThreatPanelFooterProps) {
  if (threats.length === 0) return null;

  const openCount = threats.filter((t) => t.status === "OPEN").length;
  const highSeverityCount = threats.filter(
    (t) => t.severity === "CRITICAL" || t.severity === "HIGH",
  ).length;

  return (
    <div className="p-3 border-t border bg-muted/50 shrink-0">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {openCount} open / {threats.length} total
        </span>
        <span>{highSeverityCount} high severity</span>
      </div>
    </div>
  );
}
