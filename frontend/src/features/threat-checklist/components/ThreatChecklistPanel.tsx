"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StrideCategory } from "@/types/canvas";
import { useThreatChecklist } from "../hooks/useThreatChecklist";
import { ChecklistProgress } from "./ChecklistProgress";
import { StrideChecklistItem } from "./StrideChecklistItem";

interface ThreatChecklistPanelProps {
  componentId: string;
  componentLabel: string;
  componentType?: import("@/types/canvas").ComponentType;
  onAddThreat?: (category: StrideCategory) => void;
  className?: string;
}

export function ThreatChecklistPanel({
  componentId,
  componentLabel,
  componentType,
  onAddThreat,
  className,
}: ThreatChecklistPanelProps): React.ReactElement | null {
  const { checklist, setResponse, progress } = useThreatChecklist(componentId);

  if (!checklist) {
    return null;
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>STRIDE Checklist for {componentLabel}</span>
          <ChecklistProgress
            completed={progress.completed}
            total={progress.total}
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {checklist.items.map((item) => (
            <StrideChecklistItem
              key={item.id}
              item={item}
              componentType={componentType}
              onResponseChange={setResponse}
              onAddThreat={onAddThreat}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
