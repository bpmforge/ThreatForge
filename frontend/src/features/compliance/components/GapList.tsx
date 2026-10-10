"use client";

import type { ComplianceGap } from "../types";
import { ComplianceGapCard } from "./ComplianceGapCard";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GapListProps {
  gaps: ComplianceGap[];
}

export function GapList({ gaps }: GapListProps) {
  const sortedGaps = [...gaps].sort((a, b) => {
    if (a.status === "NOT_ADDRESSED" && b.status !== "NOT_ADDRESSED") return -1;
    if (b.status === "NOT_ADDRESSED" && a.status !== "NOT_ADDRESSED") return 1;
    if (a.status === "PARTIAL" && b.status === "COVERED") return -1;
    if (b.status === "PARTIAL" && a.status === "COVERED") return 1;
    return 0;
  });

  if (sortedGaps.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No compliance gaps found
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-200px)] pr-4">
      <div className="space-y-4">
        {sortedGaps.map((gap) => (
          <ComplianceGapCard key={gap.controlId} gap={gap} />
        ))}
      </div>
    </ScrollArea>
  );
}
