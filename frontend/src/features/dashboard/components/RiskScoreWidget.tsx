/**
 * RiskScoreWidget - Visual risk score indicator for dashboard
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Shield, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";

interface RiskScoreWidgetProps {
  totalThreats: number;
  openThreats: number;
  criticalThreats: number;
  mitigatedThreats: number;
  isLoading?: boolean;
}

function calculateRiskScore(
  totalThreats: number,
  openThreats: number,
  criticalThreats: number,
  mitigatedThreats: number,
): { score: number; label: string; color: string; Icon: typeof Shield } {
  if (totalThreats === 0) {
    return {
      score: 100,
      label: "No Threats",
      color: "text-blue-600",
      Icon: Shield,
    };
  }

  const mitigationRate = mitigatedThreats / totalThreats;
  const criticalWeight = criticalThreats * 20;
  const openWeight = (openThreats - criticalThreats) * 5;

  let score = Math.round(
    100 - criticalWeight - openWeight + mitigationRate * 30,
  );
  score = Math.max(0, Math.min(100, score));

  if (score >= 80) {
    return { score, label: "Good", color: "text-green-600", Icon: ShieldCheck };
  } else if (score >= 60) {
    return { score, label: "Moderate", color: "text-yellow-700", Icon: Shield };
  } else if (score >= 40) {
    return {
      score,
      label: "Needs Attention",
      color: "text-orange-600",
      Icon: ShieldAlert,
    };
  } else {
    return { score, label: "Critical", color: "text-red-600", Icon: ShieldX };
  }
}

export function RiskScoreWidget({
  totalThreats,
  openThreats,
  criticalThreats,
  mitigatedThreats,
  isLoading,
}: RiskScoreWidgetProps) {
  const { score, label, color, Icon } = calculateRiskScore(
    totalThreats,
    openThreats,
    criticalThreats,
    mitigatedThreats,
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center h-[120px]">
          <div className="animate-pulse bg-muted rounded-full h-16 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Security Posture</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className={cn("relative", color)}>
            <Icon className="h-12 w-12" />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
              {score}
            </span>
          </div>
          <div>
            <div className={cn("text-lg font-semibold", color)}>{label}</div>
            <div className="text-xs text-muted-foreground">
              {mitigatedThreats}/{totalThreats} mitigated
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
