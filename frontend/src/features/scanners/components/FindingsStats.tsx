"use client";

import type { FindingStats, FindingSeverity } from "../types";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Shield, AlertTriangle, AlertCircle, Info, Bug } from "lucide-react";

interface FindingsStatsProps {
  stats: FindingStats;
}

export function FindingsStats({ stats }: FindingsStatsProps) {
  const severityConfig: Record<
    FindingSeverity,
    { label: string; color: string; bgColor: string; icon: typeof Shield }
  > = {
    CRITICAL: {
      label: "Critical",
      color: "text-red-700",
      bgColor: "bg-red-100",
      icon: AlertTriangle,
    },
    HIGH: {
      label: "High",
      color: "text-orange-700",
      bgColor: "bg-orange-100",
      icon: AlertCircle,
    },
    MEDIUM: {
      label: "Medium",
      color: "text-yellow-700",
      bgColor: "bg-yellow-100",
      icon: Shield,
    },
    LOW: {
      label: "Low",
      color: "text-blue-700",
      bgColor: "bg-blue-100",
      icon: Info,
    },
    INFO: {
      label: "Info",
      color: "text-gray-700",
      bgColor: "bg-gray-100",
      icon: Bug,
    },
  };

  const severities: FindingSeverity[] = [
    "CRITICAL",
    "HIGH",
    "MEDIUM",
    "LOW",
    "INFO",
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {severities.map((severity) => {
        const config = severityConfig[severity];
        const count = stats.bySeverity[severity] || 0;
        const Icon = config.icon;

        return (
          <Card
            key={severity}
            className={cn("overflow-hidden", count > 0 && config.bgColor)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Icon className={cn("h-4 w-4", config.color)} />
                <span className={cn("text-xs font-medium", config.color)}>
                  {config.label}
                </span>
              </div>
              <div
                className={cn(
                  "text-2xl font-bold mt-1",
                  count > 0 ? config.color : "",
                )}
              >
                {count}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
