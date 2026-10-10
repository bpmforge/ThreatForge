"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SEVERITY_COLORS } from "./threat-refinement-utils";
import type { ThreatUpdateSuggestion } from "./threat-refinement-utils";

interface ThreatUpdateCardProps {
  update: ThreatUpdateSuggestion;
  onApply: () => void;
}

export function ThreatUpdateCard({ update, onApply }: ThreatUpdateCardProps) {
  return (
    <div className="mr-8 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-3 space-y-2">
      <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Suggested updates
      </p>
      {update.name && (
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Name
          </span>
          <p className="text-xs mt-0.5">{update.name}</p>
        </div>
      )}
      {update.description && (
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Description
          </span>
          <p className="text-xs mt-0.5 leading-relaxed">{update.description}</p>
        </div>
      )}
      {update.severity && (
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Severity
          </span>
          <span
            className={cn(
              "ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white",
              SEVERITY_COLORS[update.severity],
            )}
          >
            {update.severity}
          </span>
        </div>
      )}
      <Button size="sm" className="w-full h-7 text-xs mt-1" onClick={onApply}>
        Apply Changes
      </Button>
    </div>
  );
}
