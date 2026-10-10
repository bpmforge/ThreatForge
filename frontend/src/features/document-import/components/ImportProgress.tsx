"use client";

/**
 * ImportProgress Component
 *
 * Shows progress during document import and parsing.
 */

import React from "react";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  Search,
  Sparkles,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ImportProgress as ImportProgressType } from "../types";

interface ImportProgressProps {
  progress: ImportProgressType;
  className?: string;
}

const stageIcons = {
  idle: FileText,
  uploading: Loader2,
  parsing: Search,
  extracting: Sparkles,
  complete: CheckCircle,
  error: AlertCircle,
};

const stageLabels = {
  idle: "Ready to import",
  uploading: "Uploading document...",
  parsing: "Parsing content...",
  extracting: "Extracting text...",
  complete: "Import complete",
  error: "Import failed",
};

export function ImportProgress({
  progress,
  className,
}: ImportProgressProps): React.ReactElement {
  const { stage, progress: percent, message, error } = progress;
  const Icon = stageIcons[stage];
  const label = message || stageLabels[stage];

  const isActive =
    stage !== "idle" && stage !== "complete" && stage !== "error";
  const isSuccess = stage === "complete";
  const isError = stage === "error";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "p-2 rounded-full",
            isActive && "bg-primary/10",
            isSuccess && "bg-green-500/10",
            isError && "bg-destructive/10",
            stage === "idle" && "bg-muted",
          )}
        >
          <Icon
            className={cn(
              "h-5 w-5",
              isActive && "text-primary animate-spin",
              isSuccess && "text-green-500",
              isError && "text-destructive",
              stage === "idle" && "text-muted-foreground",
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-medium truncate",
              isError && "text-destructive",
            )}
          >
            {label}
          </p>
          {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
        </div>
        {isActive && (
          <span className="text-sm text-muted-foreground">{percent}%</span>
        )}
      </div>

      {isActive && <Progress value={percent} className="h-2" />}

      {isSuccess && (
        <div className="text-xs text-muted-foreground">
          Document imported successfully. Ready for AI analysis.
        </div>
      )}
    </div>
  );
}
