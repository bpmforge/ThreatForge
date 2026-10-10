"use client";

/**
 * Usage & Quotas Component
 *
 * Displays organization usage statistics and quota limits.
 */
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  FolderKanban,
  FileBox,
  Bot,
  TrendingUp,
  AlertTriangle,
  Loader2,
  DollarSign,
  Zap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api-client";
import {
  QuotaCard,
  AIUsageCard,
  formatNumber,
  formatCost,
} from "./usage-quota-cards";

interface UsageData {
  organization: { id: string; name: string; plan: string };
  quotas: {
    members: {
      current: number;
      limit: number | null;
      percentage: number | null;
    };
    projects: {
      current: number;
      limit: number | null;
      percentage: number | null;
    };
    modelsPerProject: number | null;
  };
  usage: { totalMembers: number; totalProjects: number; totalModels: number };
  ai: {
    providers: Array<{
      id: string;
      name: string;
      type: string;
      requests: number;
      tokens: number;
      inputTokens: number;
      outputTokens: number;
      estimatedCost: number;
      resetAt: string;
    }>;
    totals: {
      requests: number;
      tokens: number;
      inputTokens: number;
      outputTokens: number;
      estimatedCost: number;
    };
  };
}

interface UsageQuotasProps {
  orgId: string;
}

export function UsageQuotas({ orgId }: UsageQuotasProps) {
  const {
    data: usage,
    isLoading,
    error,
  } = useQuery<UsageData>({
    queryKey: ["organization-usage", orgId],
    queryFn: () => apiGet<UsageData>(`/api/organizations/${orgId}/usage`),
    enabled: !!orgId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !usage) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Failed to load usage data</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Usage &amp; Quotas
              </CardTitle>
              <CardDescription>
                Monitor your organization&apos;s resource usage and limits.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              {usage.organization.plan || "Free"} Plan
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <QuotaCard
              title="Members"
              description="Team members in your organization"
              icon={Users}
              current={usage.quotas.members.current}
              limit={usage.quotas.members.limit}
              percentage={usage.quotas.members.percentage}
            />
            <QuotaCard
              title="Projects"
              description="Projects created"
              icon={FolderKanban}
              current={usage.quotas.projects.current}
              limit={usage.quotas.projects.limit}
              percentage={usage.quotas.projects.percentage}
            />
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <FileBox className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h4 className="font-medium">Threat Models</h4>
                  <p className="text-sm text-muted-foreground">
                    Total models created
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold">
                    {usage.usage.totalModels}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {usage.quotas.modelsPerProject
                      ? `Max ${usage.quotas.modelsPerProject} per project`
                      : "Unlimited"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Usage This Month
          </CardTitle>
          <CardDescription>
            Token usage and estimated costs for AI features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usage.ai.providers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No AI providers configured.</p>
              <p className="text-sm">
                Configure providers in the AI Providers tab.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  {
                    icon: Zap,
                    label: "Total Requests",
                    value: formatNumber(usage.ai.totals.requests),
                  },
                  {
                    icon: TrendingUp,
                    label: "Total Tokens",
                    value: formatNumber(usage.ai.totals.tokens),
                  },
                  {
                    icon: TrendingUp,
                    label: "Input / Output",
                    value: `${formatNumber(usage.ai.totals.inputTokens)} / ${formatNumber(usage.ai.totals.outputTokens)}`,
                  },
                  {
                    icon: DollarSign,
                    label: "Est. Cost",
                    value: formatCost(usage.ai.totals.estimatedCost),
                  },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Icon className="h-4 w-4" />
                      <span className="text-sm">{label}</span>
                    </div>
                    <p className="text-2xl font-bold">{value}</p>
                  </div>
                ))}
              </div>
              {usage.ai.providers.length > 1 && (
                <div>
                  <h4 className="font-medium mb-3">By Provider</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    {usage.ai.providers.map((provider) => (
                      <AIUsageCard key={provider.id} provider={provider} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
