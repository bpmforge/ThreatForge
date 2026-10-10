"use client";

import { useState } from "react";
import { useAttackSurface } from "../hooks/useAttackSurface";
import { AttackSurfaceList } from "./AttackSurfaceList";
import { AttackSurfaceChart } from "./AttackSurfaceChart";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  BarChart3,
  Shield,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AttackSurfacePanelProps {
  modelId: string;
}

export function AttackSurfacePanel({ modelId }: AttackSurfacePanelProps) {
  const { data, isLoading, error, refetch, isFetching } =
    useAttackSurface(modelId);
  const [activeTab, setActiveTab] = useState<"list" | "chart">("list");

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="w-full">
        <CardContent className="py-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive mb-2" />
          <p className="text-destructive">
            {error?.message || "Failed to load attack surface analysis"}
          </p>
          <Button variant="outline" onClick={() => refetch()} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { summary, riskDistribution } = data;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Attack Surface Analysis
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {data.modelName} • Analyzed{" "}
            {new Date(data.analyzedAt).toLocaleDateString()}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh analysis"
        >
          <RefreshCw
            className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Components"
            value={summary.totalComponents}
            icon={<Shield className="h-4 w-4" />}
          />
          <StatCard
            label="Interfaces"
            value={summary.totalInterfaces}
            subValue={`${summary.internetFacing} internet-facing`}
          />
          <StatCard
            label="Avg Risk Score"
            value={summary.averageRiskScore.toFixed(1)}
            variant={
              summary.averageRiskScore > 7
                ? "danger"
                : summary.averageRiskScore > 4
                  ? "warning"
                  : "success"
            }
          />
          <StatCard
            label="Mitigation Coverage"
            value={`${summary.coveragePercentage}%`}
            variant={
              summary.coveragePercentage > 80
                ? "success"
                : summary.coveragePercentage > 50
                  ? "warning"
                  : "danger"
            }
          />
        </div>

        {/* Risk Distribution */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">
            Risk Distribution:
          </span>
          {riskDistribution.critical > 0 && (
            <Badge variant="destructive">
              {riskDistribution.critical} Critical
            </Badge>
          )}
          {riskDistribution.high > 0 && (
            <Badge className="bg-orange-500 hover:bg-orange-600">
              {riskDistribution.high} High
            </Badge>
          )}
          {riskDistribution.medium > 0 && (
            <Badge className="bg-yellow-500 hover:bg-yellow-600">
              {riskDistribution.medium} Medium
            </Badge>
          )}
          {riskDistribution.low > 0 && (
            <Badge className="bg-green-500 hover:bg-green-600">
              {riskDistribution.low} Low
            </Badge>
          )}
          {riskDistribution.info > 0 && (
            <Badge variant="secondary">{riskDistribution.info} Info</Badge>
          )}
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "list" | "chart")}
        >
          <TabsList>
            <TabsTrigger value="list">Components</TabsTrigger>
            <TabsTrigger value="chart">
              <BarChart3 className="w-4 h-4 mr-2" />
              Visualization
            </TabsTrigger>
          </TabsList>
          <TabsContent value="list" className="mt-4">
            <AttackSurfaceList components={data.components} />
          </TabsContent>
          <TabsContent value="chart" className="mt-4">
            <AttackSurfaceChart
              components={data.components}
              exposureMatrix={data.exposureMatrix}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
}

function StatCard({
  label,
  value,
  subValue,
  icon,
  variant = "default",
}: StatCardProps) {
  const variantStyles = {
    default: "",
    success: "text-green-600",
    warning: "text-yellow-600",
    danger: "text-red-600",
  };

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-semibold mt-1 ${variantStyles[variant]}`}>
        {value}
      </div>
      {subValue && (
        <div className="text-xs text-muted-foreground">{subValue}</div>
      )}
    </div>
  );
}
