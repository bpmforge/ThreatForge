"use client";

import { Activity, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "./system-metrics-utils";

interface Trace {
  traceId: string;
  rootSpan?: string;
  startTime: number;
  spanCount: number;
}

interface SystemTracesCardProps {
  traces: Trace[] | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  onSelectTrace: (id: string) => void;
}

export function SystemTracesCard({
  traces,
  isLoading,
  onRefresh,
  onSelectTrace,
}: SystemTracesCardProps) {
  return (
    <div className="bg-background rounded-lg border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          Recent Traces
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
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted rounded" />
          ))}
        </div>
      ) : traces && traces.length > 0 ? (
        <div className="space-y-2 max-h-80 overflow-auto">
          {traces.map((trace) => (
            <button
              key={trace.traceId}
              onClick={() => onSelectTrace(trace.traceId)}
              className="w-full p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-sm">
                  {trace.rootSpan || "Unknown"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatTimestamp(trace.startTime)} - {trace.spanCount} spans
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm text-center py-4">
          No recent traces
        </p>
      )}
    </div>
  );
}
