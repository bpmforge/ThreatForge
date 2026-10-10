"use client";

import { severityBadge, toSeverity } from "@/lib/severity";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import type { GapThreat } from "../services/gap-analysis-api";

export function GapThreatRow({
  threat,
  covered,
}: {
  threat: GapThreat;
  covered: boolean;
}) {
  return (
    <div className="px-4 py-2.5 hover:bg-muted/30 border-b last:border-0">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          {covered ? (
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium truncate">{threat.name}</span>
            <span
              className={`text-[10px] px-1 py-0.5 rounded ${severityBadge({ severity: toSeverity(threat.severity), variant: "soft" })}`}
            >
              {threat.severity}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {threat.category && (
              <span className="text-[10px] text-muted-foreground">
                {threat.category}
              </span>
            )}
            {covered && threat.controlCategories.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {threat.controlCategories.slice(0, 3).map((c) => (
                  <Badge
                    key={c}
                    variant="outline"
                    className="text-[9px] h-3.5 px-1 py-0"
                  >
                    {c}
                  </Badge>
                ))}
                {threat.controlCategories.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{threat.controlCategories.length - 3}
                  </span>
                )}
              </div>
            )}
            {!covered && threat.cweIds.length > 0 && (
              <span className="text-[10px] text-amber-600">
                {threat.cweIds.slice(0, 2).join(", ")}
              </span>
            )}
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {threat.mitigationCount} mit.
        </span>
      </div>
    </div>
  );
}
