/**
 * Settings API service.
 */
import { apiGet, apiPatch } from "@/lib/api-client";
import type { AISettings, AIStatus } from "../types";

/** Fetch AI settings for a threat model */
export function fetchAISettings(modelId: string): Promise<AISettings> {
  return apiGet<AISettings>(`/api/threat-models/${modelId}/ai-settings`);
}

/** Update AI settings for a threat model */
export function updateAISettings(
  modelId: string,
  settings: Partial<AISettings>,
): Promise<AISettings> {
  return apiPatch<AISettings>(
    `/api/threat-models/${modelId}/ai-settings`,
    settings,
  );
}

/** Get AI availability status for a threat model */
export function fetchAIStatus(modelId: string): Promise<AIStatus> {
  return apiGet<AIStatus>(`/api/threat-models/${modelId}/ai-status`);
}
