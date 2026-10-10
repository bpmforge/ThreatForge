"use client";

import { severityDot } from "@/lib/severity";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { RISK_FRAMEWORKS } from "../../constants/risk-frameworks";
import type { RiskFramework } from "../../types/risk-frameworks";

interface FrameworkCollapsibleProps {
  framework: RiskFramework;
  expanded: boolean;
  onToggle: () => void;
  score?: string;
  severity?: string;
  children: React.ReactNode;
}

export function FrameworkCollapsible({
  framework,
  expanded,
  onToggle,
  score,
  severity,
  children,
}: FrameworkCollapsibleProps) {
  const info = RISK_FRAMEWORKS.find((f) => f.value === framework);
  const severityColor = severity ? severityDot(severity) : "";

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between px-3 py-2 h-auto hover:bg-muted/50"
        >
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <span className="font-medium">{info?.label}</span>
          </div>
          {score && (
            <div className="flex items-center gap-2">
              {severity ? (
                <span
                  className={`px-2 py-0.5 rounded text-xs text-white ${severityColor}`}
                >
                  {score}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">{score}</span>
              )}
            </div>
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 pt-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
