"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";

interface ExecutionStatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  loading?: boolean;
}

export function ExecutionStatCard({
  title,
  value,
  icon,
  loading,
}: ExecutionStatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs">{title}</span>
        </div>
        {loading ? (
          <div className="h-7 bg-muted rounded w-20 animate-pulse" />
        ) : (
          <p className="text-2xl font-semibold">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
