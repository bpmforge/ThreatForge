/**
 * StatsCard - Display a single statistic with icon and trend
 */
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
}

export function StatsCard({
  title,
  value,
  icon,
  trend,
  className = "",
}: StatsCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0)
      return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (trend.value < 0)
      return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (!trend) return "";
    if (trend.value > 0) return "text-green-600";
    if (trend.value < 0) return "text-red-600";
    return "text-muted-foreground";
  };

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-1 text-3xl font-semibold text-foreground">
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            {trend && (
              <div
                className={`mt-2 flex items-center gap-1 text-xs ${getTrendColor()}`}
              >
                {getTrendIcon()}
                <span>
                  {trend.value > 0 ? "+" : ""}
                  {trend.value} {trend.label}
                </span>
              </div>
            )}
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
