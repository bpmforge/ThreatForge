"use client";

import type { ComplianceGap } from "../types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Circle } from "lucide-react";

interface ComplianceGapCardProps {
  gap: ComplianceGap;
}

export function ComplianceGapCard({ gap }: ComplianceGapCardProps) {
  const getStatusIcon = () => {
    switch (gap.status) {
      case "NOT_ADDRESSED":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "PARTIAL":
        return <Circle className="h-4 w-4 text-yellow-500" />;
      case "COVERED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{gap.controlName}</h3>
          <p className="text-sm text-muted-foreground">{gap.controlId}</p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          {getStatusIcon()}
          <span className="capitalize">{gap.status.replace("_", " ")}</span>
        </Badge>
      </div>
      <div className="space-y-1">
        {gap.recommendedActions.map((action, i) => (
          <p key={i} className="text-sm flex gap-2">
            <span>•</span>
            {action}
          </p>
        ))}
      </div>
    </Card>
  );
}
