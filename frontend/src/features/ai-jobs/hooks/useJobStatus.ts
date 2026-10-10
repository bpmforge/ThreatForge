/**
 * Hook to poll job status until the job reaches a state that will not change
 * on its own (COMPLETED, FAILED, CANCELLED, PAUSED). CANCELLED/PAUSED only
 * leave that state through a user action (Resume), which re-enqueues and
 * re-mounts the poll.
 *
 * Polling also stops once the status request itself fails (React Query has
 * already retried it) or answers without a job: a deleted job or a server
 * error must not leave the UI polling every 3 seconds forever.
 */
import { useQuery } from "@tanstack/react-query";
import { apiGet, ApiError } from "@/lib/api-client";

const POLL_INTERVAL_MS = 3000;
const TERMINAL_STATUSES = new Set([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "PAUSED",
]);

/** `false` stops polling; otherwise the interval in ms. */
export function jobStatusRefetchInterval(
  status: string | undefined,
  requestFailed = false,
): number | false {
  if (requestFailed) return false;
  return status && TERMINAL_STATUSES.has(status) ? false : POLL_INTERVAL_MS;
}

/** Fetch a job's status; throws when the job cannot be read. */
export async function fetchJobStatus(jobId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  try {
    data = await apiGet(`/api/ai-jobs/${jobId}`);
  } catch (err) {
    if (err instanceof ApiError) {
      throw new Error(`Could not read job status (HTTP ${err.statusCode})`);
    }
    throw err;
  }
  // An empty body unwraps to {} (no job), which must not read as a job.
  if (!data || Object.keys(data).length === 0) {
    throw new Error("Job status response had no job");
  }
  return data;
}

export function useJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: ["ai-job", jobId],
    queryFn: () => fetchJobStatus(jobId as string),
    enabled: !!jobId,
    refetchInterval: (query) =>
      jobStatusRefetchInterval(
        query.state.data?.status,
        query.state.status === "error",
      ),
  });
}
