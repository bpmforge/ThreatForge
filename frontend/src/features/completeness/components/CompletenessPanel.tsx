"use client";

import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCompletenessScore } from "../hooks/useCompletenessScore";
import { CompletenessScoreCard } from "./CompletenessScoreCard";
import { CompletenessBreakdown } from "./CompletenessBreakdown";
import { ImprovementSuggestions } from "./ImprovementSuggestions";
import { MissingCoverageList } from "./MissingCoverageList";
import { MaturityScoreCard } from "./MaturityScoreCard";

interface CompletenessPanelProps {
  modelId: string;
}

export function CompletenessPanel({
  modelId,
}: CompletenessPanelProps): React.ReactElement {
  const { score, gaps, suggestions, isCalculating } =
    useCompletenessScore(modelId);

  if (isCalculating) {
    return (
      <div className="p-4 space-y-3">
        <div className="text-sm font-medium text-muted-foreground">
          Model Completeness
        </div>
        <div className="space-y-2">
          <div className="h-20 rounded-lg bg-muted animate-pulse" />
          <div className="h-32 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        <div className="text-sm font-medium text-muted-foreground">
          Model Completeness
        </div>

        <MaturityScoreCard modelId={modelId} />

        <CompletenessScoreCard modelId={modelId} />

        <CompletenessBreakdown strideCoverage={score?.strideCoverage} />

        {gaps.length > 0 && <MissingCoverageList gaps={gaps} />}

        {suggestions.length > 0 && (
          <ImprovementSuggestions suggestions={suggestions} />
        )}
      </div>
    </ScrollArea>
  );
}
