/**
 * Admin System Monitoring Page
 *
 * Displays cache statistics, system metrics, and request traces.
 */
"use client";

import { Activity } from "lucide-react";
import { CacheStatsPanel, SystemMetricsPanel } from "@/features/admin";

export default function AdminMonitoringPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Activity className="h-6 w-6 text-muted-foreground" />
          System Monitoring
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cache performance, system metrics, and request tracing
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cache Statistics */}
        <CacheStatsPanel />

        {/* System Metrics & Traces */}
        <SystemMetricsPanel />
      </div>
    </div>
  );
}
