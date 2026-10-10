/**
 * Admin API — Audit log
 */

import type { AuditLogEntry } from "../types";
import { apiGet, apiGetBlob } from "@/lib/api-client";

// =============================================================================
// Audit Log
// =============================================================================

export async function getAuditLog(params?: {
  entityType?: string;
  action?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.entityType) searchParams.set("entityType", params.entityType);
  if (params?.action) searchParams.set("action", params.action);
  if (params?.userId) searchParams.set("userId", params.userId);
  if (params?.startDate) searchParams.set("startDate", params.startDate);
  if (params?.endDate) searchParams.set("endDate", params.endDate);
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.limit) searchParams.set("limit", params.limit.toString());

  const query = searchParams.toString();
  return apiGet(`/api/admin/audit${query ? `?${query}` : ""}`);
}

// =============================================================================
// Audit Export
// =============================================================================

export async function exportAuditLog(params?: {
  format?: "csv" | "json";
  entityType?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Blob> {
  const searchParams = new URLSearchParams();
  if (params?.format) searchParams.set("format", params.format);
  if (params?.entityType) searchParams.set("entityType", params.entityType);
  if (params?.action) searchParams.set("action", params.action);
  if (params?.startDate) searchParams.set("startDate", params.startDate);
  if (params?.endDate) searchParams.set("endDate", params.endDate);

  const query = searchParams.toString();
  return apiGetBlob(`/api/admin/audit/export${query ? `?${query}` : ""}`);
}
