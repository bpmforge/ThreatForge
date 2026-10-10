"use client";

/**
 * AIUsageSummary - Display AI usage statistics for an organization.
 *
 * Shows total requests, tokens, estimated cost, and breakdown by provider/model.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Loader2,
  AlertCircle,
  Coins,
  Zap,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { apiGet } from "@/lib/api-client";

interface AIUsageData {
  summary: {
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalCost: number;
    avgLatencyMs: number;
  };
  byProvider: Array<{
    providerId: string;
    providerName: string;
    requests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalCost: number;
    avgLatencyMs: number;
  }>;
  byModel: Array<{
    model: string;
    requests: number;
    totalTokens: number;
    totalCost: number;
  }>;
}

interface AIUsageSummaryProps {
  orgId: string;
}

async function fetchAIUsage(
  orgId: string,
  period: string,
): Promise<AIUsageData> {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Current month
  }

  const params = new URLSearchParams();
  params.set("startDate", startDate.toISOString());
  params.set("endDate", now.toISOString());

  try {
    return await apiGet<AIUsageData>(
      `/api/organizations/${orgId}/ai-usage?${params}`,
    );
  } catch {
    throw new Error("Failed to fetch AI usage");
  }
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

export function AIUsageSummary({ orgId }: AIUsageSummaryProps) {
  const [period, setPeriod] = useState("30d");

  const { data, isLoading, error } = useQuery({
    queryKey: ["ai-usage", orgId, period],
    queryFn: () => fetchAIUsage(orgId, period),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-destructive">
        <AlertCircle className="h-5 w-5 mr-2" />
        Failed to load AI usage data
      </div>
    );
  }

  if (!data || data.summary.totalRequests === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <BarChart3 className="h-8 w-8 mb-2" />
        <p>No AI usage data for this period.</p>
      </div>
    );
  }

  const maxProviderTokens = Math.max(
    ...data.byProvider.map((p) => p.totalTokens),
    1,
  );

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex justify-end">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="month">This month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Zap className="h-4 w-4" />
              Total Requests
            </div>
            <p className="text-2xl font-bold mt-1">
              {formatNumber(data.summary.totalRequests)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingUp className="h-4 w-4" />
              Total Tokens
            </div>
            <p className="text-2xl font-bold mt-1">
              {formatNumber(data.summary.totalTokens)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatNumber(data.summary.totalInputTokens)} in /{" "}
              {formatNumber(data.summary.totalOutputTokens)} out
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Coins className="h-4 w-4" />
              Estimated Cost
            </div>
            <p className="text-2xl font-bold mt-1">
              {formatCost(data.summary.totalCost)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="h-4 w-4" />
              Avg Latency
            </div>
            <p className="text-2xl font-bold mt-1">
              {data.summary.avgLatencyMs.toLocaleString()}ms
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage by Provider */}
      {data.byProvider.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Usage by Provider</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.byProvider.map((provider) => (
              <div key={provider.providerId} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{provider.providerName}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{formatNumber(provider.requests)} requests</span>
                    <span>{formatNumber(provider.totalTokens)} tokens</span>
                    <Badge variant="outline">
                      {formatCost(provider.totalCost)}
                    </Badge>
                  </div>
                </div>
                <Progress
                  value={(provider.totalTokens / maxProviderTokens) * 100}
                  className="h-2"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Usage by Model */}
      {data.byModel.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Usage by Model</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.byModel.slice(0, 5).map((model) => (
                <div
                  key={model.model}
                  className="flex items-center justify-between text-sm py-1"
                >
                  <span className="font-mono text-xs truncate max-w-[200px]">
                    {model.model}
                  </span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{formatNumber(model.requests)} req</span>
                    <span>{formatNumber(model.totalTokens)} tokens</span>
                    <Badge variant="outline">
                      {formatCost(model.totalCost)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
