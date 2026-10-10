"use client";

import { Cpu, HardDrive, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SparklineChart } from "./SparklineChart";
import { formatBytes, formatUptime } from "./system-metrics-utils";

interface SystemInfo {
  uptime: number;
  nodeVersion: string;
  platform: string;
  arch: string;
  memoryUsage: { heapUsed: number; heapTotal: number; rss: number };
}

interface SystemInfoCardProps {
  systemInfo: SystemInfo | undefined;
  isLoading: boolean;
  memoryHistory: number[];
  rssHistory: number[];
  onRefresh: () => void;
}

export function SystemInfoCard({
  systemInfo,
  isLoading,
  memoryHistory,
  rssHistory,
  onRefresh,
}: SystemInfoCardProps) {
  const memoryUsagePercent = systemInfo
    ? (systemInfo.memoryUsage.heapUsed / systemInfo.memoryUsage.heapTotal) * 100
    : 0;

  return (
    <div className="bg-background rounded-lg border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Cpu className="h-5 w-5 text-muted-foreground" />
          System Metrics
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-muted rounded" />
        </div>
      ) : systemInfo ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                Uptime
              </div>
              <p className="text-xl font-bold">
                {formatUptime(systemInfo.uptime)}
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Node.js</div>
              <p className="text-xl font-bold">{systemInfo.nodeVersion}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Platform</div>
              <p className="text-xl font-bold capitalize">
                {systemInfo.platform} ({systemInfo.arch})
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <HardDrive className="h-4 w-4" />
                RSS Memory
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xl font-bold">
                  {formatBytes(systemInfo.memoryUsage.rss)}
                </p>
                {rssHistory.length > 1 && (
                  <SparklineChart
                    data={rssHistory}
                    color="var(--color-primary)"
                    label="RSS memory"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Heap Memory Usage</span>
                {memoryHistory.length > 1 && (
                  <SparklineChart
                    data={memoryHistory}
                    max={systemInfo.memoryUsage.heapTotal}
                    color="var(--color-primary)"
                    label="Heap memory"
                  />
                )}
              </div>
              <span>
                {formatBytes(systemInfo.memoryUsage.heapUsed)} /{" "}
                {formatBytes(systemInfo.memoryUsage.heapTotal)}
              </span>
            </div>
            <Progress value={memoryUsagePercent} className="h-2" />
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          Unable to load system info
        </p>
      )}
    </div>
  );
}
