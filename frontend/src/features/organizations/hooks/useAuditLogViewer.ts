"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { ApiError, apiGet, apiGetBlob } from "@/lib/api-client";

export interface AuditLog {
  id: string;
  scope: string;
  action: string;
  resourceType: string;
  resourceId: string;
  resourceName: string | null;
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  userId: string;
  userEmail: string;
  createdAt: string;
}

export function useAuditLogViewer(organizationId: string) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (action) params.set("action", action);
      if (resourceType) params.set("resourceType", resourceType);
      if (startDate) params.set("startDate", new Date(startDate).toISOString());
      if (endDate) params.set("endDate", new Date(endDate).toISOString());
      params.set("limit", String(limit));
      params.set("offset", String(page * limit));

      const data = await apiGet<{ logs?: AuditLog[]; total?: number }>(
        `/api/organizations/${organizationId}/audit?${params}`,
      );
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } catch (error) {
      // Non-2xx responses were previously ignored silently
      if (!(error instanceof ApiError)) {
        toast.error("Failed to load audit logs");
      }
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, action, resourceType, startDate, endDate, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  async function exportLogs(format: "csv" | "json") {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("format", format);
      if (action) params.set("action", action);
      if (resourceType) params.set("resourceType", resourceType);
      if (startDate) params.set("startDate", new Date(startDate).toISOString());
      if (endDate) params.set("endDate", new Date(endDate).toISOString());

      const blob = await apiGetBlob(
        `/api/organizations/${organizationId}/audit/export?${params}`,
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Export downloaded");
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error("Export failed", { description: error.message });
      } else {
        toast.error("Export failed");
      }
    } finally {
      setIsExporting(false);
    }
  }

  const clearFilters = () => {
    setAction("");
    setResourceType("");
    setStartDate("");
    setEndDate("");
    setPage(0);
  };

  const hasFilters = !!(action || resourceType || startDate || endDate);
  const totalPages = Math.ceil(total / limit);

  return {
    logs,
    total,
    isLoading,
    isExporting,
    action,
    setAction,
    resourceType,
    setResourceType,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    page,
    setPage,
    limit,
    totalPages,
    hasFilters,
    exportLogs,
    clearFilters,
  };
}
