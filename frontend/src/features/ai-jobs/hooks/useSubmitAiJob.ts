/**
 * Hook for submitting AI jobs (async or sync)
 */
import { useQueryClient } from "@tanstack/react-query";
import { apiPost, ApiError } from "@/lib/api-client";

/** Thrown on HTTP 429 (org AI quota exhausted); `message` is the server's text. */
export class AiQuotaExceededError extends Error {
  readonly code = "AI_QUOTA_EXCEEDED";
  constructor(message: string) {
    super(message);
    this.name = "AiQuotaExceededError";
  }
}

/** User-facing message for a failed AI job submission: quota text wins over the fallback. */
export function aiJobErrorMessage(err: unknown, fallback: string): string {
  return err instanceof AiQuotaExceededError ? err.message : fallback;
}

export function useSubmitAiJob() {
  const queryClient = useQueryClient();

  const submit = async (
    url: string,
    body: object,
    options?: { async?: boolean },
  ) => {
    const asyncMode = options?.async ?? true;
    const separator = url.includes("?") ? "&" : "?";
    const finalUrl = asyncMode ? `${url}${separator}async=true` : url;

    let payload: unknown;
    try {
      payload = await apiPost<unknown>(finalUrl, body);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      const generic = `Request failed with status ${err.statusCode}`;
      const message = err.message === generic ? "" : err.message;
      if (err.statusCode === 429) {
        throw new AiQuotaExceededError(
          message || "AI quota reached for your organization.",
        );
      }
      throw new Error(
        message ||
          `AI request failed (HTTP ${err.statusCode}) — is the backend running?`,
      );
    }

    // 202 queues a job ({ jobId, status, statusUrl }); the client strips the
    // HTTP status, so a queued job is recognised by its jobId.
    const job = payload as {
      jobId?: string;
      status?: string;
      statusUrl?: string;
    } | null;
    if (asyncMode && job && typeof job === "object" && "jobId" in job) {
      queryClient.invalidateQueries({ queryKey: ["ai-jobs"] });
      return {
        async: true,
        jobId: job.jobId,
        status: job.status,
        statusUrl: job.statusUrl,
      };
    }

    // Sync — immediate result
    return { async: false, result: payload };
  };

  return { submit };
}
