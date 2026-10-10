"use client";

import { useMemo } from "react";
import type { ComplianceAnalysis } from "../types";
import { cn } from "@/lib/utils";

interface CoverageMatrixProps {
  analysis: ComplianceAnalysis;
}

export function CoverageMatrix({ analysis }: CoverageMatrixProps) {
  const {
    coveragePercentage,
    totalControls,
    coveredControls,
    partialControls,
  } = analysis;

  const statusColor = useMemo(() => {
    if (coveragePercentage >= 80) return "text-green-500";
    if (coveragePercentage >= 50) return "text-yellow-500";
    return "text-red-500";
  }, [coveragePercentage]);

  return (
    <div className="p-4 bg-card rounded-lg shadow border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          Coverage Matrix
        </h3>
        <span className={cn("text-3xl font-bold", statusColor)}>
          {coveragePercentage}%
        </span>
      </div>
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1 text-foreground">
          <span>Total Controls</span>
          <span>{totalControls}</span>
        </div>
        <div className="flex justify-between text-sm mb-1 text-foreground">
          <span>Covered</span>
          <span>{coveredControls}</span>
        </div>
        <div className="flex justify-between text-sm mb-1 text-foreground">
          <span>Partial</span>
          <span>{partialControls}</span>
        </div>
      </div>
      <div className="w-full bg-muted rounded-full h-2.5">
        <div
          className="bg-primary h-2.5 rounded-full"
          style={{ width: `${coveragePercentage}%` }}
        ></div>
      </div>
    </div>
  );
}
