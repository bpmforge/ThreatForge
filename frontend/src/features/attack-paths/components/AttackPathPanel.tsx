"use client";

/**
 * AttackPathPanel - Displays discovered attack paths through the model.
 */
import { severityDot } from "@/lib/severity";
import { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { AttackPath } from "../types";

interface AttackPathPanelProps {
  paths: AttackPath[];
  onSelectPath?: (path: AttackPath) => void;
  onSelectStep?: (nodeId: string) => void;
}

const LIKELIHOOD_STYLES = {
  HIGH: "text-red-600 bg-red-50",
  MEDIUM: "text-yellow-600 bg-yellow-50",
  LOW: "text-green-600 bg-green-50",
};

export function AttackPathPanel({
  paths,
  onSelectPath,
  onSelectStep,
}: AttackPathPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (paths.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Shield className="mx-auto h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No attack paths detected.</p>
        <p className="text-xs mt-1">
          Add threats to components to see potential attack chains.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-2">
        <div className="text-xs text-muted-foreground px-2 mb-2">
          {paths.length} attack path{paths.length !== 1 ? "s" : ""} identified
        </div>

        {paths.map((path) => {
          const isExpanded = expandedId === path.id;
          return (
            <div
              key={path.id}
              className="border rounded-lg bg-card overflow-hidden"
            >
              <button
                className="w-full p-3 text-left flex items-start gap-2 hover:bg-muted/50"
                onClick={() => {
                  setExpandedId(isExpanded ? null : path.id);
                  onSelectPath?.(path);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span className="font-medium text-sm truncate">
                      {path.name}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        LIKELIHOOD_STYLES[path.likelihood],
                      )}
                    >
                      {path.likelihood} likelihood
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Risk: {path.totalRisk}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {path.steps.length} steps
                    </Badge>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t px-3 py-2 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-2">
                    {path.description}
                  </p>
                  <div className="space-y-1">
                    {path.steps.map((step, idx) => (
                      <button
                        key={step.id}
                        className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted text-left text-sm"
                        onClick={() => onSelectStep?.(step.nodeId)}
                      >
                        <span className="text-xs text-muted-foreground w-4">
                          {idx + 1}.
                        </span>
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            severityDot(step.severity),
                          )}
                        />
                        <span className="flex-1 truncate">
                          {step.threatName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {step.nodeName}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
