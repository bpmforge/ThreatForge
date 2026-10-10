"use client";

import React from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { STRIDE_CATEGORIES } from "@/features/threats/constants";

export function CompletenessBreakdown({
  strideCoverage,
  className,
}: {
  strideCoverage: Record<string, { covered: number; total: number }>;
  className?: string;
}): React.ReactElement {
  return (
    <div className={cn("space-y-4", className)}>
      {STRIDE_CATEGORIES.map((category) => {
        const coverage = strideCoverage[category.value];
        const percentage = coverage?.total
          ? Math.round((coverage.covered / coverage.total) * 100)
          : 0;
        const isZeroCoverage = coverage?.covered === 0 && coverage?.total > 0;

        return (
          <div key={category.value} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span
                className={cn(isZeroCoverage && "text-red-500 font-medium")}
              >
                {category.label}
              </span>
              <span className={cn(isZeroCoverage && "text-red-500")}>
                {coverage?.covered}/{coverage?.total} covered
              </span>
            </div>
            <Progress
              value={percentage}
              className={cn(isZeroCoverage && "bg-red-500/20")}
            />
          </div>
        );
      })}
    </div>
  );
}
