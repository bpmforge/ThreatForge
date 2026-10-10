"use client";

import { useState, useEffect, useRef } from "react";
import { useSystemInfo, useTraces, useTrace } from "../hooks/useAdmin";
import { SystemInfoCard } from "./SystemInfoCard";
import { SystemTracesCard } from "./SystemTracesCard";
import { TraceDetailDialog } from "./TraceDetailDialog";

const MAX_HISTORY = 20;

export function SystemMetricsPanel(): React.ReactElement {
  const {
    data: systemInfo,
    isLoading: systemLoading,
    refetch: refetchSystem,
  } = useSystemInfo();
  const {
    data: traces,
    isLoading: tracesLoading,
    refetch: refetchTraces,
  } = useTraces(20);

  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const { data: traceDetail } = useTrace(selectedTraceId || "");
  const [memoryHistory, setMemoryHistory] = useState<number[]>([]);
  const [rssHistory, setRssHistory] = useState<number[]>([]);
  const lastRecorded = useRef<number>(0);

  useEffect(() => {
    if (!systemInfo) return;
    const now = Date.now();
    if (now - lastRecorded.current < 2000) return;
    lastRecorded.current = now;
    setMemoryHistory((prev) =>
      [...prev, systemInfo.memoryUsage.heapUsed].slice(-MAX_HISTORY),
    );
    setRssHistory((prev) =>
      [...prev, systemInfo.memoryUsage.rss].slice(-MAX_HISTORY),
    );
  }, [systemInfo]);

  useEffect(() => {
    const interval = setInterval(() => refetchSystem(), 15000);
    return () => clearInterval(interval);
  }, [refetchSystem]);

  return (
    <div className="space-y-6">
      <SystemInfoCard
        systemInfo={systemInfo}
        isLoading={systemLoading}
        memoryHistory={memoryHistory}
        rssHistory={rssHistory}
        onRefresh={refetchSystem}
      />
      <SystemTracesCard
        traces={traces}
        isLoading={tracesLoading}
        onRefresh={refetchTraces}
        onSelectTrace={setSelectedTraceId}
      />
      <TraceDetailDialog
        open={!!selectedTraceId}
        onClose={() => setSelectedTraceId(null)}
        traceDetail={traceDetail}
      />
    </div>
  );
}
