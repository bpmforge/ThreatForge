"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Zap, Search, CheckCircle } from "lucide-react";

interface ProgramHealth {
  meanTimeToMitigate: number;
  mitigationVelocity: number;
  threatDiscoveryRate: number;
  reviewRate: number;
}

interface Props {
  health: ProgramHealth;
  isLoading?: boolean;
}

interface MetricTileProps {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  good: boolean;
}

function MetricTile({ label, value, sub, icon: Icon, good }: MetricTileProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-4">
      <div
        className={`rounded-full p-2 ${good ? "bg-green-100 text-green-600 dark:bg-green-900/30" : "bg-orange-100 text-orange-600 dark:bg-orange-900/30"}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

export function ProgramHealthPanel({ health, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Program Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Program Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <MetricTile
            label="Mean Time to Mitigate"
            value={`${health.meanTimeToMitigate}d`}
            sub="avg days threat → IMPLEMENTED"
            icon={Clock}
            good={health.meanTimeToMitigate <= 30}
          />
          <MetricTile
            label="Mitigation Velocity"
            value={`${health.mitigationVelocity}/wk`}
            sub="completions per week (4-wk avg)"
            icon={Zap}
            good={health.mitigationVelocity >= 1}
          />
          <MetricTile
            label="Threat Discovery Rate"
            value={`${health.threatDiscoveryRate}/wk`}
            sub="new threats per week (4-wk avg)"
            icon={Search}
            good={health.threatDiscoveryRate < health.mitigationVelocity}
          />
          <MetricTile
            label="Review Rate"
            value={`${health.reviewRate}%`}
            sub="AI suggestions reviewed"
            icon={CheckCircle}
            good={health.reviewRate >= 80}
          />
        </div>
      </CardContent>
    </Card>
  );
}
