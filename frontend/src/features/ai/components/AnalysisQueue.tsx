"use client";

import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  PauseCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface AiJob {
  id: string;
  type: string;
  status: string;
  progress: number;
  progressMessage: string | null;
  error: string | null;
  result: string | null;
  queuedAt: string;
}

interface AnalysisQueueProps {
  jobs: AiJob[];
  activeJobId: string | null;
  busyIds: Set<string>;
  dismissedIds: Set<string>;
  onCancel: (id: string) => void;
  onPause: (id: string) => void;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
}

function statusIcon(status: string) {
  if (status === "QUEUED")
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  if (status === "PROCESSING")
    return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
  if (status === "COMPLETED")
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === "PAUSED")
    return <PauseCircle className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-red-500" />;
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" {
  if (status === "COMPLETED") return "default";
  if (status === "FAILED") return "destructive";
  return "secondary";
}

function statusLabel(status: string) {
  if (status === "PROCESSING") return "Running";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function AnalysisQueue({
  jobs,
  activeJobId,
  busyIds,
  dismissedIds,
  onCancel,
  onPause,
  onRetry,
  onDismiss,
}: AnalysisQueueProps) {
  const visible = jobs.filter((j) => !dismissedIds.has(j.id));
  if (visible.length === 0) return null;

  return (
    <div className="px-2 pt-2 pb-1 border-b space-y-1.5">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
        Analysis Queue
      </p>
      {visible.map((job) => (
        <div
          key={job.id}
          className={`flex items-start gap-2 p-2 rounded-md border text-sm ${
            job.id === activeJobId
              ? "border-primary/40 bg-primary/5 dark:border-primary/50 dark:bg-primary/10"
              : "bg-card"
          }`}
        >
          <div className="mt-0.5 shrink-0">{statusIcon(job.status)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium">Threat Analysis</span>
              <Badge
                variant={statusVariant(job.status)}
                className="text-[10px] h-4 px-1"
              >
                {statusLabel(job.status)}
              </Badge>
              {job.status === "PROCESSING" &&
                job.progressMessage?.startsWith("Persisted") && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 dark:text-green-300 dark:bg-green-950/40 dark:border-green-900 rounded px-1 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    Live
                  </span>
                )}
              {job.status === "PROCESSING" && job.progress > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {job.progress}%
                </span>
              )}
            </div>

            {job.status === "PROCESSING" && (
              <Progress
                value={job.progress}
                className="h-1.5 mt-1.5"
                aria-label="AI analysis progress"
              />
            )}
            {job.status === "PROCESSING" && job.progressMessage && (
              <p className="text-[11px] text-foreground/80 mt-1 break-words leading-snug">
                {job.progressMessage}
              </p>
            )}
            {job.status === "PROCESSING" && !job.progressMessage && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Starting analysis…
              </p>
            )}
            {job.status === "QUEUED" && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Queued — will start shortly
              </p>
            )}
            {(job.status === "FAILED" || job.status === "CANCELLED") && (
              <p className="text-[11px] text-destructive mt-0.5">
                {job.error ?? "Stopped"}
                {job.status === "CANCELLED" && " — checkpoint saved"}
              </p>
            )}
            {job.status === "PAUSED" && (
              <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-0.5">
                Paused — use Resume to continue
              </p>
            )}
            {job.status === "COMPLETED" && (
              <>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Results loaded below
                </p>
                {(() => {
                  try {
                    const r = job.result
                      ? (JSON.parse(job.result as string) as {
                          summary?: { parseFailures?: number };
                        })
                      : null;
                    const n = r?.summary?.parseFailures ?? 0;
                    return n > 0 ? (
                      <p className="text-[11px] text-amber-600 mt-0.5">
                        {n} AI output{n > 1 ? "s were" : " was"} discarded due
                        to malformed JSON.
                      </p>
                    ) : null;
                  } catch {
                    return null;
                  }
                })()}
              </>
            )}

            <div className="flex gap-1 mt-1.5">
              {job.status === "PROCESSING" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  disabled={busyIds.has(job.id)}
                  onClick={() => onPause(job.id)}
                >
                  {busyIds.has(job.id) ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "⏸ Pause"
                  )}
                </Button>
              )}
              {(job.status === "QUEUED" || job.status === "PROCESSING") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-destructive hover:text-destructive"
                  disabled={busyIds.has(job.id)}
                  onClick={() => onCancel(job.id)}
                >
                  {busyIds.has(job.id) ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Cancel"
                  )}
                </Button>
              )}
              {(job.status === "FAILED" ||
                job.status === "CANCELLED" ||
                job.status === "PAUSED") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  disabled={busyIds.has(job.id)}
                  onClick={() => onRetry(job.id)}
                >
                  {busyIds.has(job.id) ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "↺ Resume"
                  )}
                </Button>
              )}
              {(job.status === "COMPLETED" ||
                job.status === "FAILED" ||
                job.status === "CANCELLED" ||
                job.status === "PAUSED") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label="Dismiss"
                  onClick={() => onDismiss(job.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
