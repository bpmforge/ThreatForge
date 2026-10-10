/**
 * AI API Service
 */
import { apiGet, apiPost } from "@/lib/api-client";
import type {
  AIAvailability,
  AISuggestedThreat,
  AISuggestedMitigation,
  AIChatResponse,
  AIMessage,
} from "../types";

/** Unwrap { data: T } from sendSuccess responses */
function unwrap<T>(json: unknown): T {
  if (json && typeof json === "object" && "data" in json) {
    return (json as { data: T }).data;
  }
  return json as T;
}

/** Check if AI is available for a threat model */
export async function checkAIAvailability(
  modelId: string,
): Promise<AIAvailability> {
  try {
    const raw = await apiGet<unknown>(
      `/api/threat-models/${modelId}/ai/available`,
    );
    return unwrap<AIAvailability>(raw);
  } catch {
    return { available: false, reason: "Request failed" };
  }
}

/** Get AI-suggested threats */
export async function suggestThreats(
  modelId: string,
): Promise<AISuggestedThreat[]> {
  const raw = await apiPost<unknown>(
    `/api/threat-models/${modelId}/ai/suggest-threats`,
    {},
  );
  const data = unwrap<{ threats?: AISuggestedThreat[] }>(raw);
  return data.threats || [];
}

/** Get AI-suggested mitigations */
export async function suggestMitigations(
  modelId: string,
  threat: { title: string; description: string; category: string },
): Promise<AISuggestedMitigation[]> {
  const raw = await apiPost<unknown>(
    `/api/threat-models/${modelId}/ai/suggest-mitigations`,
    threat,
  );
  const data = unwrap<{ mitigations?: AISuggestedMitigation[] }>(raw);
  return data.mitigations || [];
}

/** Run micro-analysis (per-component, per-category) */
export async function runMicroAnalysis(
  modelId: string,
  options?: {
    methodologies?: string[];
    minConfidence?: number;
  },
): Promise<{ jobId?: string; data?: unknown }> {
  const raw = await apiPost<unknown>(
    `/api/threat-models/${modelId}/ai/micro-analysis`,
    options || {},
  );
  return unwrap<{ jobId?: string; data?: unknown }>(raw);
}

/** Chat with AI */
export function chat(
  modelId: string,
  message: string,
  history: AIMessage[] = [],
): Promise<AIChatResponse> {
  return apiPost<AIChatResponse>(`/api/threat-models/${modelId}/ai/chat`, {
    message,
    history,
  });
}

/** Iterative refinement chat for a specific threat */
export async function refineThreat(
  modelId: string,
  threatId: string,
  message: string,
  history: AIMessage[] = [],
): Promise<AIChatResponse> {
  const raw = await apiPost<unknown>(
    `/api/threat-models/${modelId}/ai/refine-threat`,
    { threatId, message, history },
  );
  return unwrap<AIChatResponse>(raw);
}
