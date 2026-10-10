"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useCompletenessScore } from "../hooks/useCompletenessScore";

interface CompletenessScoreCardProps {
  modelId: string | null | undefined;
  className?: string;
}

export function CompletenessScoreCard({
  modelId,
  className,
}: CompletenessScoreCardProps): React.ReactElement {
  const { score, isCalculating } = useCompletenessScore(modelId);

  if (isCalculating) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle>Completeness Score</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">Calculating...</p>
        </CardContent>
      </Card>
    );
  }

  if (score.totalComponents === 0) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle>Completeness Score</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            No components available
          </p>
        </CardContent>
      </Card>
    );
  }

  const percentage = score.overall;
  let color = "text-red-500";
  let strokeColor = "#ef4444";
  if (percentage >= 80) {
    color = "text-green-500";
    strokeColor = "#22c55e";
  } else if (percentage >= 50) {
    color = "text-yellow-500";
    strokeColor = "#eab308";
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>Completeness Score</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div className="relative w-32 h-32 mb-4">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={strokeColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - percentage / 100)}`}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-2xl font-bold ${color}`}>{percentage}%</span>
          </div>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {score.componentsCovered} of {score.totalComponents} components
          covered
        </p>
        <p className="text-center text-sm text-muted-foreground">
          {score.threatsWithMitigations} of {score.totalThreats} threats have
          mitigations
        </p>
      </CardContent>
    </Card>
  );
}
