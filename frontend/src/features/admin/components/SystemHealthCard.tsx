/**
 * SystemHealthCard - Display system health status
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Database,
  Clock,
} from "lucide-react";
import type { SystemHealth } from "../types";

interface SystemHealthCardProps {
  health?: SystemHealth;
  isLoading: boolean;
  error?: Error | null;
}

export function SystemHealthCard({
  health,
  isLoading,
  error,
}: SystemHealthCardProps) {
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "degraded":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case "unhealthy":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
      case "degraded":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">Degraded</Badge>
        );
      case "unhealthy":
        return <Badge className="bg-red-100 text-red-800">Unhealthy</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return "N/A";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-4 bg-muted rounded w-1/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            <span>Failed to load health status</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">System Health</CardTitle>
          {getStatusBadge(health?.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Status */}
        <div className="flex items-center gap-3">
          {getStatusIcon(health?.status)}
          <span className="text-sm text-muted-foreground">
            System is {health?.status || "unknown"}
          </span>
        </div>

        {/* Database */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Database</span>
          </div>
          <div className="flex items-center gap-2">
            {health?.database.connected ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-foreground">
                  {health.database.latencyMs}ms
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-red-600">Disconnected</span>
              </>
            )}
          </div>
        </div>

        {/* Uptime */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Uptime</span>
          </div>
          <span className="text-foreground">
            {formatUptime(health?.uptime)}
          </span>
        </div>

        {/* Version */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Version</span>
          <span className="text-foreground font-mono text-xs">
            {health?.version || "Unknown"}
          </span>
        </div>

        {/* Last Check */}
        <div className="text-xs text-muted-foreground text-right">
          Last checked:{" "}
          {health?.lastChecked
            ? new Date(health.lastChecked).toLocaleTimeString()
            : "N/A"}
        </div>
      </CardContent>
    </Card>
  );
}
