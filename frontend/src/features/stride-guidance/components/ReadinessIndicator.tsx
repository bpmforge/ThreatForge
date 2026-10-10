"use client";

import { useState } from "react";
import {
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ReadinessResult, ReadinessCheck } from "../types";

interface ReadinessIndicatorProps {
  result: ReadinessResult;
  onFixAction?: (check: ReadinessCheck) => void;
  className?: string;
}

const statusConfig = {
  "not-ready": {
    icon: AlertTriangle,
    label: "Not Ready",
    color: "text-red-600",
    bgColor: "bg-red-500",
  },
  "needs-work": {
    icon: AlertCircle,
    label: "Needs Work",
    color: "text-yellow-600",
    bgColor: "bg-yellow-500",
  },
  "almost-ready": {
    icon: AlertCircle,
    label: "Almost Ready",
    color: "text-blue-600",
    bgColor: "bg-blue-500",
  },
  ready: {
    icon: CheckCircle,
    label: "Ready",
    color: "text-green-600",
    bgColor: "bg-green-500",
  },
};

export function ReadinessIndicator({
  result,
  onFixAction,
  className,
}: ReadinessIndicatorProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const config = statusConfig[result.status];
  const Icon = config.icon;

  const allIssues = [
    ...result.blockers,
    ...result.warnings,
    ...result.suggestions,
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("gap-2 h-8", className)}
          aria-label={`Model readiness: ${result.percentage}%`}
        >
          <span className="text-sm text-muted-foreground">Ready:</span>
          <Badge variant="secondary" className={cn("gap-1", config.color)}>
            <Icon className="h-3 w-3" />
            {result.percentage}%
          </Badge>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Model Readiness</h4>
              <Badge className={cn("text-white", config.bgColor)}>
                {config.label}
              </Badge>
            </div>
            <Progress value={result.percentage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {result.score} of {result.maxScore} criteria passed
            </p>
          </div>

          {/* Issues list */}
          {allIssues.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {result.blockers.map((check) => (
                <CheckItem
                  key={check.id}
                  check={check}
                  type="blocker"
                  onFix={onFixAction}
                />
              ))}
              {result.warnings.map((check) => (
                <CheckItem
                  key={check.id}
                  check={check}
                  type="warning"
                  onFix={onFixAction}
                />
              ))}
              {result.suggestions.map((check) => (
                <CheckItem
                  key={check.id}
                  check={check}
                  type="suggestion"
                  onFix={onFixAction}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm font-medium">All checks passed!</p>
              <p className="text-xs text-muted-foreground">
                Your model meets all readiness criteria
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CheckItem({
  check,
  type,
  onFix,
}: {
  check: ReadinessCheck;
  type: "blocker" | "warning" | "suggestion";
  onFix?: (check: ReadinessCheck) => void;
}) {
  const typeConfig = {
    blocker: { icon: AlertTriangle, color: "text-red-600", label: "Required" },
    warning: { icon: AlertCircle, color: "text-yellow-600", label: "Warning" },
    suggestion: {
      icon: AlertCircle,
      color: "text-blue-600",
      label: "Suggestion",
    },
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
      <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", config.color)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{check.name}</p>
        <p className="text-xs text-muted-foreground">{check.message}</p>
      </div>
      {check.fixAction && onFix && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs flex-shrink-0"
          onClick={() => onFix(check)}
        >
          {check.fixAction.label}
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      )}
    </div>
  );
}
