"use client";

/**
 * PipelineStageTimeline Component
 *
 * Step-by-step timeline of stage executions within a pipeline run.
 */

import React from "react";
import { Clock, Coins, Database, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ExecutionStatus, PipelineStageExecution } from "../types";
import { STATUS_ICONS, STATUS_COLORS } from "./PipelineExecutionStatus";
import {
  estimateCostUsd,
  formatCostUsd,
  isCacheHit,
} from "../utils/stage-metrics";

interface PipelineStageTimelineProps {
  stages: PipelineStageExecution[];
  currentStageId?: string | null;
}

export function PipelineStageTimeline({
  stages,
  currentStageId,
}: PipelineStageTimelineProps): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Stage Execution</CardTitle>
        <CardDescription>Step-by-step execution progress</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {stages.map((stage, index) => (
            <StageRow
              key={stage.id}
              stage={stage}
              index={index}
              isLast={index === stages.length - 1}
              isCurrent={currentStageId === stage.stageId}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface StageRowProps {
  stage: PipelineStageExecution;
  index: number;
  isLast: boolean;
  isCurrent: boolean;
}

function StageRow({
  stage,
  index,
  isLast,
  isCurrent,
}: StageRowProps): React.ReactElement {
  const cached = isCacheHit(stage);
  return (
    <div className="flex items-start gap-3">
      {/* Timeline */}
      <div className="flex flex-col items-center">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
            isCurrent ? "border-blue-500 bg-blue-50" : "border-muted"
          }`}
        >
          {STATUS_ICONS[stage.status as ExecutionStatus]}
        </div>
        {!isLast && (
          <div
            className={`w-0.5 h-8 ${
              stage.status === "COMPLETED"
                ? STATUS_COLORS[stage.status as ExecutionStatus]
                : "bg-muted"
            }`}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">Stage {index + 1}</span>
            <Badge variant="outline" className="text-xs">
              {stage.status}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {cached && (
              <Badge
                variant="secondary"
                className="text-xs flex items-center gap-1"
              >
                <Database className="h-3 w-3" aria-hidden="true" />
                Cached
              </Badge>
            )}
            {stage.durationMs != null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {stage.durationMs}ms
              </span>
            )}
            {stage.tokensUsed != null && (
              <span className="flex items-center gap-1">
                <Coins className="h-3 w-3" aria-hidden="true" />
                {stage.tokensUsed.toLocaleString()}
                {cached && " (cached)"}
              </span>
            )}
            {stage.tokensUsed != null && stage.tokensUsed > 0 && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" aria-hidden="true" />
                {formatCostUsd(cached ? 0 : estimateCostUsd(stage.tokensUsed))}
              </span>
            )}
            {stage.retryAttempts > 0 && (
              <Badge variant="secondary" className="text-xs">
                {stage.retryAttempts} retries
              </Badge>
            )}
          </div>
        </div>

        {stage.errorMessage && (
          <p className="text-xs text-destructive mt-1">{stage.errorMessage}</p>
        )}
      </div>
    </div>
  );
}
