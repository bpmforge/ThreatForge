"use client";

/**
 * FocusedModelStats - Displays detailed stats for a focused threat model.
 *
 * Shows STRIDE breakdown, risk score, and mitigation progress.
 */
import { useRouter } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Shield,
  X,
  ExternalLink,
  Target,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useThreatModelStats } from "../hooks/useDashboard";
import { STRIDEBreakdown } from "./STRIDEBreakdown";

interface FocusedModelStatsProps {
  modelId: string;
  modelName: string;
  onClearFocus: () => void;
}

function RiskScoreGauge({ score }: { score: number }) {
  let color = "text-green-500";
  let label = "Low Risk";

  if (score >= 75) {
    color = "text-red-500";
    label = "Critical";
  } else if (score >= 50) {
    color = "text-orange-500";
    label = "High Risk";
  } else if (score >= 25) {
    color = "text-yellow-500";
    label = "Medium Risk";
  }

  return (
    <div className="flex flex-col items-center">
      <div className={`text-4xl font-bold ${color}`}>{score}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function FocusedModelStats({
  modelId,
  modelName,
  onClearFocus,
}: FocusedModelStatsProps) {
  const router = useRouter();
  const { data: stats, isLoading, error } = useThreatModelStats(modelId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center text-destructive">
          <AlertCircle className="h-5 w-5 mr-2" />
          Failed to load model stats
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with model name and actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">{modelName}</CardTitle>
                <CardDescription>
                  v{stats.version} | Last modified{" "}
                  {new Date(stats.lastModified).toLocaleDateString()}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/models/${modelId}`)}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open
              </Button>
              <Button variant="ghost" size="sm" onClick={onClearFocus}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overview Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.componentCount}</div>
              <div className="text-xs text-muted-foreground">Components</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.connectionCount}</div>
              <div className="text-xs text-muted-foreground">Connections</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.boundaryCount}</div>
              <div className="text-xs text-muted-foreground">Boundaries</div>
            </div>
            <div className="text-center">
              <RiskScoreGauge score={stats.riskScore} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Threat Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Threat Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="flex items-center gap-2 p-2 rounded bg-destructive/10">
              <div className="text-lg font-bold text-destructive">
                {stats.openThreats}
              </div>
              <div className="text-xs">Open</div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-yellow-500/10">
              <div className="text-lg font-bold text-yellow-600">
                {stats.inProgressThreats}
              </div>
              <div className="text-xs">In Progress</div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-green-500/10">
              <div className="text-lg font-bold text-green-600">
                {stats.mitigatedThreats}
              </div>
              <div className="text-xs">Mitigated</div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-muted">
              <div className="text-lg font-bold text-muted-foreground">
                {stats.acceptedThreats}
              </div>
              <div className="text-xs">Accepted</div>
            </div>
          </div>

          {/* Critical/High badges */}
          <div className="flex gap-2">
            {stats.criticalThreats > 0 && (
              <Badge variant="destructive">
                {stats.criticalThreats} Critical
              </Badge>
            )}
            {stats.highThreats > 0 && (
              <Badge
                variant="outline"
                className="border-orange-500 text-orange-500"
              >
                {stats.highThreats} High
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* STRIDE Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            STRIDE Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <STRIDEBreakdown
            breakdown={stats.strideBreakdown}
            totalThreats={stats.totalThreats}
          />
        </CardContent>
      </Card>

      {/* Mitigation Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Mitigation Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>
              {stats.completedMitigations} of {stats.totalMitigations}{" "}
              mitigations complete
            </span>
            <span className="font-bold">{stats.mitigationProgress}%</span>
          </div>
          <Progress value={stats.mitigationProgress} className="h-2" />
          {stats.mitigationProgress === 100 && stats.totalMitigations > 0 && (
            <Badge
              variant="outline"
              className="bg-green-500/10 text-green-600 border-green-500"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              All mitigations implemented
            </Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
