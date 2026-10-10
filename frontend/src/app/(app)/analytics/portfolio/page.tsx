"use client";

import { AppHeader } from "@/components/layout";
import { StatsCard } from "@/features/dashboard/components/StatsCard";
import { PortfolioRiskHeatmap } from "@/features/dashboard/components/PortfolioRiskHeatmap";
import { TopUnmitigatedThreats } from "@/features/dashboard/components/TopUnmitigatedThreats";
import { TrendChart } from "@/features/dashboard/components/TrendChart";
import { ProgramHealthPanel } from "@/features/dashboard/components/ProgramHealthPanel";
import { usePortfolioDashboard } from "@/features/dashboard/hooks/usePortfolioDashboard";
import { useCurrentOrgId } from "@/stores/org-store";
import { useOrganizations } from "@/features/organizations/hooks/useOrganization";
import {
  LayoutDashboard,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  Activity,
  FolderOpen,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

const PERIODS = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "Last year", value: "1y" },
  { label: "All time", value: "all" },
];

export default function PortfolioDashboardPage() {
  const orgId = useCurrentOrgId();
  const { data: orgs } = useOrganizations();
  const effectiveOrgId = orgId || orgs?.[0]?.id || null;
  const [period, setPeriod] = useState("30d");

  const { data, isLoading } = usePortfolioDashboard(effectiveOrgId, period);

  if (!isLoading && !data) {
    return (
      <>
        <AppHeader />
        <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
          <div className="text-center space-y-3 max-w-sm">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h2 className="text-lg font-semibold">No portfolio data yet</h2>
            <p className="text-sm text-muted-foreground">
              Create threat models and add threats to see org-wide risk posture,
              compliance coverage, and trend charts here.
            </p>
          </div>
        </main>
      </>
    );
  }

  const mitigationRate =
    data && data.summary.totalThreats > 0
      ? Math.round(
          (data.summary.totalMitigations / data.summary.totalThreats) * 100,
        )
      : 0;

  const openCritical = data?.riskDistribution.critical ?? 0;

  return (
    <>
      <AppHeader />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Portfolio Dashboard
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {data?.organizationName ?? "Organization"} — org-wide risk posture
            </p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40" aria-label="Report period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatsCard
            title="Total Models"
            value={data?.summary.totalModels ?? 0}
            icon={LayoutDashboard}
            isLoading={isLoading}
          />
          <StatsCard
            title="Total Threats"
            value={data?.summary.totalThreats ?? 0}
            icon={AlertTriangle}
            isLoading={isLoading}
          />
          <StatsCard
            title="Open Critical"
            value={openCritical}
            icon={AlertTriangle}
            urgency={openCritical > 0 ? "danger" : "default"}
            isLoading={isLoading}
          />
          <StatsCard
            title="Mitigation Rate"
            value={`${mitigationRate}%`}
            icon={ShieldCheck}
            urgency={
              mitigationRate >= 70
                ? "success"
                : mitigationRate >= 40
                  ? "warning"
                  : "danger"
            }
            isLoading={isLoading}
          />
          <StatsCard
            title="Avg Risk Score"
            value={Math.round(data?.summary.averageRiskScore ?? 0)}
            icon={TrendingUp}
            urgency={
              (data?.summary.averageRiskScore ?? 0) >= 70
                ? "danger"
                : (data?.summary.averageRiskScore ?? 0) >= 40
                  ? "warning"
                  : "success"
            }
            isLoading={isLoading}
          />
          <StatsCard
            title="Avg Compliance"
            value={`${Math.round(data?.summary.averageComplianceScore ?? 0)}%`}
            icon={Activity}
            urgency={
              (data?.summary.averageComplianceScore ?? 0) >= 70
                ? "success"
                : "warning"
            }
            isLoading={isLoading}
          />
        </div>

        {/* Heatmap + Top threats */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <PortfolioRiskHeatmap models={data?.modelSummaries ?? []} />
          <TopUnmitigatedThreats threats={data?.topRisks ?? []} />
        </div>

        {/* Trend charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TrendChart
            title="Threat Activity"
            series={[
              {
                label: "New",
                color: "#ef4444",
                data: data?.trends.newThreats ?? [],
              },
              {
                label: "Mitigated",
                color: "#22c55e",
                data: data?.trends.mitigatedThreats ?? [],
              },
            ]}
          />
          <TrendChart
            title="Open Threats Over Time"
            series={[
              {
                label: "Open",
                color: "#f97316",
                data: data?.trends.openThreats ?? [],
              },
            ]}
          />
        </div>

        {/* Program Health */}
        {data?.programHealth && (
          <ProgramHealthPanel
            health={data.programHealth}
            isLoading={isLoading}
          />
        )}

        {/* Compliance overview */}
        {data?.complianceOverview && data.complianceOverview.length > 0 && (
          <div className="rounded-lg border p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Compliance Coverage
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.complianceOverview.map((fw) => (
                <div key={fw.framework} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium truncate">{fw.framework}</span>
                    <span className="text-muted-foreground">{fw.score}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${fw.score}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {fw.gaps} gaps
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
