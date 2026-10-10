/**
 * Version history API service
 */

import type {
  ThreatModelVersion,
  ThreatModelVersionDetail,
  CreateVersionRequest,
} from "../types";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";

/** Get version history for a threat model */
export async function getVersionHistory(
  modelId: string,
): Promise<ThreatModelVersion[]> {
  return apiGet<ThreatModelVersion[]>(`/api/threat-models/${modelId}/versions`);
}

/** Get a specific version with full canvas state */
export async function getVersion(
  modelId: string,
  versionId: string,
): Promise<ThreatModelVersionDetail> {
  return apiGet<ThreatModelVersionDetail>(
    `/api/threat-models/${modelId}/versions/${versionId}`,
  );
}

/** Create a new version (snapshot current state) */
export async function createVersion(
  modelId: string,
  data?: CreateVersionRequest,
): Promise<ThreatModelVersion> {
  return apiPost<ThreatModelVersion>(
    `/api/threat-models/${modelId}/versions`,
    data || {},
  );
}

/** Restore a previous version (creates new version with old state) */
export async function restoreVersion(
  modelId: string,
  versionId: string,
): Promise<ThreatModelVersion> {
  return apiPost<ThreatModelVersion>(
    `/api/threat-models/${modelId}/versions/${versionId}/restore`,
  );
}

/** Update version metadata (name, summary) */
export async function updateVersion(
  modelId: string,
  versionId: string,
  data: { name?: string; changesSummary?: string },
): Promise<ThreatModelVersion> {
  return apiPatch<ThreatModelVersion>(
    `/api/threat-models/${modelId}/versions/${versionId}`,
    data,
  );
}
