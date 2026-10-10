/**
 * StatsCard - Dashboard statistic card component
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Urgency = "default" | "success" | "warning" | "danger";

interface StatsCardProps {
  title: string;
  value: number | string;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  isLoading?: boolean;
  urgency?: Urgency;
  onClick?: () => void;
}

const urgencyStyles: Record<
  Urgency,
  { border: string; icon: string; value: string }
> = {
  default: { border: "", icon: "text-muted-foreground", value: "" },
  success: {
    border: "border-green-500/50",
    icon: "text-green-500",
    value: "text-green-700 dark:text-green-400",
  },
  warning: {
    border: "border-yellow-500/50",
    icon: "text-yellow-500",
    value: "text-yellow-700 dark:text-yellow-400",
  },
  danger: {
    border: "border-red-500/50",
    icon: "text-red-500",
    value: "text-red-700 dark:text-red-400",
  },
};

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  isLoading,
  urgency = "default",
  onClick,
}: StatsCardProps) {
  const styles = urgencyStyles[urgency];

  return (
    <Card
      className={cn(
        styles.border,
        onClick && "cursor-pointer hover:bg-muted/50 transition-colors",
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className={cn("h-4 w-4", styles.icon)} />}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-24" />
          </>
        ) : (
          <>
            <div className={cn("text-2xl font-bold", styles.value)}>
              {value}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {trend && (
              <p
                className={`text-xs ${trend.positive ? "text-green-600" : "text-red-600"}`}
              >
                {trend.positive ? "+" : ""}
                {trend.value}% {trend.label}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
