/**
 * Refinement Questions API Service
 *
 * Fetches follow-up questions to improve model completeness.
 */
import { apiPost } from "@/lib/api-client";
import type { RefinementResponse } from "../types";

/** Get refinement questions for a threat model */
export async function getRefinementQuestions(
  modelId: string,
): Promise<RefinementResponse> {
  return apiPost<RefinementResponse>(
    `/api/threat-models/${modelId}/ai/suggest-questions`,
    {},
  );
}
