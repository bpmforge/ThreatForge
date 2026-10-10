/**
 * useExecutionLogs Hook - Fetch prompt execution logs and statistics
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "../services/api";
import type { GetLogsOptions } from "../services/api";

const LOGS_KEY = "executionLogs";
const STATS_KEY = "executionStats";

export function useExecutionLogs(
  orgId: string | undefined,
  options: GetLogsOptions = {},
) {
  return useQuery({
    queryKey: [LOGS_KEY, orgId, options],
    queryFn: () =>
      orgId
        ? api.getExecutionLogs(orgId, options)
        : Promise.reject("Missing org"),
    enabled: !!orgId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useExecutionLog(
  orgId: string | undefined,
  logId: string | undefined,
) {
  return useQuery({
    queryKey: [LOGS_KEY, orgId, logId],
    queryFn: () =>
      orgId && logId
        ? api.getExecutionLog(orgId, logId)
        : Promise.reject("Missing IDs"),
    enabled: !!orgId && !!logId,
  });
}

export function useExecutionStats(
  orgId: string | undefined,
  days: number = 30,
) {
  return useQuery({
    queryKey: [STATS_KEY, orgId, days],
    queryFn: () =>
      orgId
        ? api.getExecutionStats(orgId, days)
        : Promise.reject("Missing org"),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
