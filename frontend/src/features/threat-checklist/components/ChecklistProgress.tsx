"use client";

import React from "react";
import { Progress } from "@/components/ui/progress";

export function ChecklistProgress({
  completed,
  total,
}: {
  completed: number;
  total: number;
}): React.ReactElement {
  const progressValue = total > 0 ? (completed / total) * 100 : 0;
  const isComplete = completed === total;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>
          {completed} of {total} reviewed
        </span>
      </div>
      <Progress
        value={progressValue}
        className={isComplete ? "bg-green-500/20" : "bg-blue-500/20"}
      />
    </div>
  );
}
