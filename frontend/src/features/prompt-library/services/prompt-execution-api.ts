import { apiGet, apiPost } from "@/lib/api-client";
import type {
  PromptExecutionLog,
  PromptExecutionStats,
  PromptUsageByPrompt,
  PreviewPromptResult,
} from "../types";

export async function previewPrompt(
  orgId: string,
  promptId: string,
  variables: Record<string, unknown>,
): Promise<PreviewPromptResult> {
  return apiPost<PreviewPromptResult>(
    `/api/organizations/${orgId}/prompts/preview`,
    { promptId, variables },
  );
}

export interface GetLogsOptions {
  promptId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface LogsResponse {
  logs: PromptExecutionLog[];
  total: number;
  limit: number;
  offset: number;
}

export async function getExecutionLogs(
  orgId: string,
  options: GetLogsOptions = {},
): Promise<LogsResponse> {
  const params = new URLSearchParams();
  if (options.promptId) params.set("promptId", options.promptId);
  if (options.status) params.set("status", options.status);
  if (options.limit) params.set("limit", String(options.limit));
  if (options.offset) params.set("offset", String(options.offset));
  const query = params.toString();
  return apiGet<LogsResponse>(
    `/api/organizations/${orgId}/prompt-logs${query ? `?${query}` : ""}`,
  );
}

export async function getExecutionLog(
  orgId: string,
  logId: string,
): Promise<PromptExecutionLog> {
  const data = await apiGet<{ log: PromptExecutionLog }>(
    `/api/organizations/${orgId}/prompt-logs/${logId}`,
  );
  return data.log;
}

export async function getExecutionStats(
  orgId: string,
  days = 30,
): Promise<{
  stats: PromptExecutionStats;
  usageByPrompt: PromptUsageByPrompt[];
  days: number;
}> {
  return apiGet(`/api/organizations/${orgId}/prompt-stats?days=${days}`);
}
