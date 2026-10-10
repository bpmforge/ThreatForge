"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, TrendingUp } from "lucide-react";

export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

interface QuotaCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  current: number;
  limit: number | null;
  percentage: number | null;
}

export function QuotaCard({
  title,
  description,
  icon: Icon,
  current,
  limit,
  percentage,
}: QuotaCardProps) {
  const isAtLimit = limit !== null && percentage !== null && percentage >= 100;
  const isNearLimit =
    limit !== null &&
    percentage !== null &&
    percentage >= 80 &&
    percentage < 100;

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <div>
            <h4 className="font-medium">{title}</h4>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {isAtLimit && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Limit Reached
          </Badge>
        )}
        {isNearLimit && (
          <Badge
            variant="outline"
            className="gap-1 border-yellow-500 text-yellow-600"
          >
            <TrendingUp className="h-3 w-3" />
            Near Limit
          </Badge>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold">{current}</span>
          <span className="text-sm text-muted-foreground">
            {limit !== null ? `of ${limit}` : "Unlimited"}
          </span>
        </div>
        {limit !== null && percentage !== null && (
          <Progress
            value={Math.min(percentage, 100)}
            className={
              isAtLimit
                ? "[&>[role=progressbar]]:bg-destructive"
                : isNearLimit
                  ? "[&>[role=progressbar]]:bg-yellow-500"
                  : ""
            }
          />
        )}
      </div>
    </div>
  );
}

interface AIUsageCardProps {
  provider: {
    name: string;
    type: string;
    requests: number;
    tokens: number;
    estimatedCost: number;
  };
}

export function AIUsageCard({ provider }: AIUsageCardProps) {
  return (
    <div className="p-3 border rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">{provider.name}</span>
        <Badge variant="secondary">{provider.type}</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">Requests</span>
          <p className="font-medium">{formatNumber(provider.requests)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Tokens</span>
          <p className="font-medium">{formatNumber(provider.tokens)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Est. Cost</span>
          <p className="font-medium">{formatCost(provider.estimatedCost)}</p>
        </div>
      </div>
    </div>
  );
}
