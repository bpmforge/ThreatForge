"use client";

/**
 * ActiveJobsList — floating panel showing QUEUED/PROCESSING AI jobs
 */
import { useJobList } from "../hooks/useJobList";
import { JobProgressCard } from "./JobProgressCard";

export function ActiveJobsList() {
  const { data: jobs } = useJobList({ status: "QUEUED,PROCESSING", limit: 10 });

  if (!jobs?.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 space-y-2">
      <p className="text-xs font-medium text-muted-foreground px-1">
        AI Jobs ({jobs.length} active)
      </p>
      {jobs.map((job: { id: string; type: string }) => (
        <JobProgressCard key={job.id} jobId={job.id} type={job.type} />
      ))}
    </div>
  );
}
