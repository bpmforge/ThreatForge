"use client";

/**
 * STRIDEBreakdown - Visual breakdown of threats by STRIDE category.
 *
 * Shows each STRIDE category with total count and severity distribution.
 */
import { AlertTriangle, Shield, Eye, Ban, Zap, Key } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { STRIDEBreakdown as STRIDEBreakdownType } from "../types";

interface STRIDEBreakdownProps {
  breakdown: STRIDEBreakdownType[];
  totalThreats: number;
}

const STRIDE_INFO: Record<
  string,
  {
    icon: typeof AlertTriangle;
    label: string;
    color: string;
    description: string;
  }
> = {
  SPOOFING: {
    icon: Key,
    label: "Spoofing",
    color: "bg-red-500",
    description: "Pretending to be someone or something else",
  },
  TAMPERING: {
    icon: AlertTriangle,
    label: "Tampering",
    color: "bg-orange-500",
    description: "Modifying data or code without authorization",
  },
  REPUDIATION: {
    icon: Eye,
    label: "Repudiation",
    color: "bg-yellow-500",
    description: "Denying having performed an action",
  },
  INFO_DISCLOSURE: {
    icon: Shield,
    label: "Info Disclosure",
    color: "bg-blue-500",
    description: "Exposing information to unauthorized users",
  },
  DOS: {
    icon: Ban,
    label: "Denial of Service",
    color: "bg-purple-500",
    description: "Making a service unavailable",
  },
  ELEVATION: {
    icon: Zap,
    label: "Elevation",
    color: "bg-pink-500",
    description: "Gaining elevated privileges without authorization",
  },
};

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-600";
    case "high":
      return "bg-orange-500";
    case "medium":
      return "bg-yellow-500";
    case "low":
      return "bg-green-500";
    default:
      return "bg-gray-400";
  }
}

export function STRIDEBreakdown({
  breakdown,
  totalThreats,
}: STRIDEBreakdownProps) {
  if (totalThreats === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Shield className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No threats identified yet</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {breakdown.map((category) => {
          const info = STRIDE_INFO[category.category];
          if (!info) return null;

          const Icon = info.icon;
          const percentage =
            totalThreats > 0 ? (category.total / totalThreats) * 100 : 0;

          return (
            <div key={category.category} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger>
                      <div className={`p-1.5 rounded ${info.color} text-white`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{info.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {info.description}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-sm font-medium">{info.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{category.total}</span>
                  {category.open > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {category.open} open
                    </Badge>
                  )}
                </div>
              </div>

              <Progress value={percentage} className="h-2" />

              {/* Severity breakdown */}
              {category.total > 0 && (
                <div className="flex gap-1">
                  {Object.entries(category.bySeverity).map(
                    ([severity, count]) => {
                      if (count === 0) return null;
                      return (
                        <Tooltip key={severity}>
                          <TooltipTrigger>
                            <div
                              className={`h-1.5 rounded ${getSeverityColor(severity)}`}
                              style={{
                                width: `${(count / category.total) * 100}%`,
                                minWidth: count > 0 ? "4px" : "0",
                              }}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="capitalize">
                              {severity}: {count}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Legend */}
        <div className="flex items-center gap-4 pt-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div
              className={`w-2 h-2 rounded ${getSeverityColor("critical")}`}
            />
            <span>Critical</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded ${getSeverityColor("high")}`} />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded ${getSeverityColor("medium")}`} />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded ${getSeverityColor("low")}`} />
            <span>Low</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
