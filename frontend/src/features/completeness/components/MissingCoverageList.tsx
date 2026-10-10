"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { STRIDE_CATEGORIES } from "@/features/threats/constants";
import type { ComponentGap } from "../types";

interface MissingCoverageListProps {
  gaps: ComponentGap[];
  onComponentClick?: (componentId: string) => void;
}

export function MissingCoverageList({
  gaps,
  onComponentClick,
}: MissingCoverageListProps): React.ReactElement {
  // Sort gaps by missingCategories length descending
  const sortedGaps = [...gaps].sort(
    (a, b) => b.missingCategories.length - a.missingCategories.length,
  );

  if (sortedGaps.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-4">
        All components have full STRIDE coverage
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortedGaps.map((gap) => (
        <div
          key={gap.componentId}
          className={`flex items-center justify-between p-3 rounded-lg border ${
            onComponentClick ? "cursor-pointer hover:bg-muted" : ""
          }`}
          onClick={() => onComponentClick?.(gap.componentId)}
          role={onComponentClick ? "button" : undefined}
          tabIndex={onComponentClick ? 0 : undefined}
          onKeyDown={(e) => {
            if (onComponentClick && (e.key === "Enter" || e.key === " ")) {
              onComponentClick(gap.componentId);
            }
          }}
        >
          <div className="flex-1">
            <div className="font-medium">{gap.componentLabel}</div>
            <div className="text-sm text-muted-foreground">
              {gap.missingCategories.length} missing STRIDE categories
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-muted-foreground">
              {gap.threatCount} threats
            </span>
            <div className="flex space-x-1">
              {STRIDE_CATEGORIES.map((category) => {
                const isMissing = gap.missingCategories.includes(
                  category.value,
                );
                return (
                  <Badge
                    key={category.value}
                    variant={isMissing ? "destructive" : "secondary"}
                    className={`px-2 py-1 text-xs ${isMissing ? "opacity-70" : ""}`}
                  >
                    {category.short}
                  </Badge>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
