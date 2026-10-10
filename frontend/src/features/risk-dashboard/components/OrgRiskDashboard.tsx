"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  BarChart3,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { OrgRiskBreakdowns } from "./OrgRiskBreakdowns";
import { OrgRiskProjectList } from "./OrgRiskProjectList";
import { apiGet } from "@/lib/api-client";

interface RiskOverview {
  summary: {
    totalProjects: number;
    totalModels: number;
    totalThreats: number;
    openThreats: number;
    mitigationRate: number;
    trend: "improving" | "stable" | "worsening";
  };
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  byStride: Record<string, number>;
  projectRisk: Array<{
    id: string;
    name: string;
    modelCount: number;
    threatCount: number;
    openThreats: number;
    criticalCount: number;
    riskScore: number;
    lastUpdated: string;
  }>;
}

function useRiskOverview(orgId: string) {
  return useQuery<RiskOverview>({
    queryKey: ["risk-overview", orgId],
    queryFn: () =>
      apiGet<RiskOverview>(`/api/organizations/${orgId}/risk-overview`),
    enabled: !!orgId,
  });
}

function SummaryCard({
  label,
  value,
  sub,
  icon,
  highlight,
}: {
  label: string;
  value: string | number;
  sub: React.ReactNode;
  icon: React.ReactNode;
  highlight?: string;
}) {
  return (
    <Card className={`py-4 ${highlight ?? ""}`}>
      <CardContent className="p-4 pt-0 pb-0">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
      </CardContent>
    </Card>
  );
}

export function OrgRiskDashboard({ orgId }: { orgId: string }) {
  const { data, isLoading, error } = useRiskOverview(orgId);

  if (isLoading)
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );

  if (error || !data)
    return (
      <div className="text-center py-8 text-muted-foreground">
        Failed to load risk overview
      </div>
    );

  const { summary, bySeverity, byStride, projectRisk } = data;

  if (summary.totalModels === 0)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          Risk Analytics
        </h1>
        <p className="text-muted-foreground max-w-md mb-6">
          Organization-wide risk metrics will appear here once you have threat
          models with threats and mitigations.
        </p>
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-4">
              Start by creating a project and adding threat models.
            </p>
            <Button asChild>
              <Link href="/projects?new=true">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Project
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );

  const TrendIcon =
    summary.trend === "improving"
      ? TrendingUp
      : summary.trend === "worsening"
        ? TrendingDown
        : Minus;
  const trendColor =
    summary.trend === "improving"
      ? "text-green-600"
      : summary.trend === "worsening"
        ? "text-red-600"
        : "text-yellow-600";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Threats"
          value={summary.totalThreats}
          sub={`${summary.openThreats} open`}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <SummaryCard
          label="Mitigation Rate"
          value={`${summary.mitigationRate}%`}
          sub={
            <span className={`flex items-center gap-1 ${trendColor}`}>
              <TrendIcon className="h-3 w-3" />
              {summary.trend}
            </span>
          }
          icon={<Shield className="h-4 w-4" />}
        />
        <SummaryCard
          label="Projects"
          value={summary.totalProjects}
          sub={`${summary.totalModels} models`}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <SummaryCard
          label="Critical Open"
          value={bySeverity.CRITICAL ?? 0}
          sub={`${bySeverity.HIGH ?? 0} high`}
          icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
          highlight={
            (bySeverity.CRITICAL ?? 0) > 0 ? "border-red-500/50" : undefined
          }
        />
      </div>

      <OrgRiskBreakdowns
        bySeverity={bySeverity}
        byStride={byStride}
        totalThreats={summary.totalThreats}
      />

      <OrgRiskProjectList projectRisk={projectRisk} />
    </div>
  );
}
