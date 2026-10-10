"use client";

import { cn } from "@/lib/utils";

interface ThreatViewTabsProps {
  view: "threats" | "remediation";
  threatsCount: number;
  onViewChange: (view: "threats" | "remediation") => void;
}

export function ThreatViewTabs({
  view,
  threatsCount,
  onViewChange,
}: ThreatViewTabsProps) {
  return (
    <div className="flex items-center border-b shrink-0" role="tablist">
      <button
        role="tab"
        aria-selected={view === "threats"}
        className={cn(
          "shrink-0 px-3 py-2 text-xs font-medium border-b-2 transition-colors",
          view === "threats"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onViewChange("threats")}
      >
        Threats ({threatsCount})
      </button>
      <button
        role="tab"
        aria-selected={view === "remediation"}
        aria-disabled={threatsCount === 0}
        title={
          threatsCount === 0
            ? "Add threats to enable remediation tracking"
            : undefined
        }
        className={cn(
          "shrink-0 px-3 py-2 text-xs font-medium border-b-2 transition-colors",
          threatsCount === 0
            ? "text-muted-foreground/50 border-transparent cursor-not-allowed"
            : view === "remediation"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
        )}
        onClick={() => threatsCount > 0 && onViewChange("remediation")}
      >
        Remediation
      </button>
    </div>
  );
}
