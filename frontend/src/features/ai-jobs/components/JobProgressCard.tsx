"use client";

/**
 * JobProgressCard — displays job status inline with progress indicator
 */
import { useEffect } from "react";
import { useJobStatus } from "../hooks/useJobStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle, X } from "lucide-react";

interface JobProgressCardProps {
  jobId: string;
  type: string;
  onComplete?: (result: unknown) => void;
  onDismiss?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  SUGGEST_THREATS: "Threat Analysis",
  EXTRACT_DOCUMENT: "Document Extraction",
  ATTACK_TREE: "Attack Tree",
  CALCULATE_SEVERITY: "Severity Calculation",
  SUGGEST_MITIGATIONS: "Mitigation Suggestions",
  SEQUENCE_DIAGRAM: "Sequence Diagram",
  REFINEMENT_QUESTIONS: "Refinement Questions",
  EXPERT_ANALYSIS: "Expert Analysis (6-Pass)",
  ATTACK_CHAIN_ANALYSIS: "Attack Chain Analysis",
  ARCHITECTURAL_MITIGATIONS: "Architectural Mitigations",
};

export function JobProgressCard({
  jobId,
  type,
  onComplete,
  onDismiss,
}: JobProgressCardProps) {
  const { data: job } = useJobStatus(jobId);

  useEffect(() => {
    if (job?.status === "COMPLETED" && onComplete) {
      onComplete(job.result);
    }
  }, [job?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!job) return null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card text-card-foreground">
      {job.status === "QUEUED" && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {job.status === "PROCESSING" && (
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      )}
      {job.status === "COMPLETED" && (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      )}
      {job.status === "FAILED" && <XCircle className="h-4 w-4 text-red-500" />}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {TYPE_LABELS[type] ?? type}
        </p>
        {job.status === "PROCESSING" && job.progress > 0 && (
          <Progress value={job.progress} className="h-1 mt-1" />
        )}
        {job.status === "FAILED" && (
          <p className="text-xs text-destructive truncate">{job.error}</p>
        )}
      </div>

      <Badge
        variant={
          job.status === "COMPLETED"
            ? "default"
            : job.status === "FAILED"
              ? "destructive"
              : "secondary"
        }
      >
        {job.status}
      </Badge>

      {onDismiss && (job.status === "COMPLETED" || job.status === "FAILED") && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label="Dismiss job"
          onClick={onDismiss}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
