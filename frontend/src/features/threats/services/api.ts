/**
 * Threats API service.
 */
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "@/lib/api-client";
import type {
  Threat,
  Mitigation,
  MitigationStrategy,
  ThreatComment,
} from "../types";
import type { StrideCategory, Severity } from "@/types/canvas";

/** API response type for paginated threats */
interface ThreatsResponse {
  data: Threat[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/** Fetch all threats for a model */
function parseJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* not valid JSON */
    }
  }
  return [];
}

export interface FetchThreatsOptions {
  /** Filter to threats created/updated after the model's most recent sign-off (#61). */
  sinceLastSignOff?: boolean;
}

export async function fetchThreats(
  modelId: string,
  options: FetchThreatsOptions = {},
): Promise<Threat[]> {
  const qs = options.sinceLastSignOff ? "?sinceLastSignOff=true" : "";
  const response = await apiGet<ThreatsResponse>(
    `/api/threat-models/${modelId}/threats${qs}`,
  );
  return response.data.map((t) => ({
    ...t,
    cweIds: parseJsonArray(t.cweIds),
    owaspIds: parseJsonArray(t.owaspIds),
  }));
}

/** Create a new threat */
export function createThreat(
  modelId: string,
  data: {
    name: string;
    description?: string;
    strideCategories: StrideCategory[];
    severity: Severity;
    category?: string; // Custom organization category
    componentNodeId?: string; // React Flow node ID
    connectionEdgeId?: string; // React Flow edge ID
  },
): Promise<Threat> {
  return apiPost<Threat>(`/api/threat-models/${modelId}/threats`, data);
}

/** Update threat status */
export function updateThreatStatus(
  modelId: string,
  threatId: string,
  status: string,
): Promise<Threat> {
  return apiPut<Threat>(`/api/threat-models/${modelId}/threats/${threatId}`, {
    status,
  });
}

/** Update threat (full update) */
export function updateThreat(
  modelId: string,
  threatId: string,
  data: {
    name?: string;
    description?: string;
    strideCategories?: StrideCategory[];
    severity?: Severity;
    status?: string;
    category?: string | null;
    manuallyEdited?: boolean;
    assigneeId?: string | null;
  },
): Promise<Threat> {
  return apiPut<Threat>(
    `/api/threat-models/${modelId}/threats/${threatId}`,
    data,
  );
}

/** Delete a threat */
export function deleteThreat(modelId: string, threatId: string): Promise<void> {
  return apiDelete(`/api/threat-models/${modelId}/threats/${threatId}`);
}

/** Create a new mitigation */
export function createMitigation(
  threatId: string,
  data: {
    description: string;
    priority: string;
    strategy: MitigationStrategy;
    notes?: string;
  },
): Promise<Mitigation> {
  return apiPost<Mitigation>(`/api/threats/${threatId}/mitigations`, data);
}

/** Update mitigation status */
export function updateMitigationStatus(
  threatId: string,
  mitigationId: string,
  status: string,
): Promise<Mitigation> {
  return apiPut<Mitigation>(
    `/api/threats/${threatId}/mitigations/${mitigationId}`,
    { status },
  );
}

/** Update mitigation (full update) */
export function updateMitigation(
  threatId: string,
  mitigationId: string,
  data: {
    description?: string;
    status?: string;
    priority?: string;
    strategy?: MitigationStrategy;
    notes?: string | null;
    controlCategory?: string | null;
    testCriteria?: string | null;
    testResult?: string | null;
    effectivenessScore?: number | null;
    implementationNotes?: string | null;
    evidenceLinks?: Array<{ type: string; url: string; title: string }> | null;
    requirementRefs?: Array<{
      docId: string;
      reqId: string;
      text: string;
    }> | null;
    requirementIds?: string[] | null;
    verified?: boolean;
    obligation?: "REQUIRED" | "RECOMMENDED";
  },
): Promise<Mitigation> {
  return apiPut<Mitigation>(
    `/api/threats/${threatId}/mitigations/${mitigationId}`,
    data,
  );
}

/** Reassign a mitigation to a different threat (same model) */
export function moveMitigation(
  sourceThreatId: string,
  mitigationId: string,
  targetThreatId: string,
): Promise<{
  id: string;
  description: string;
  status: string;
  threatId: string;
}> {
  return apiPatch(
    `/api/threats/${sourceThreatId}/mitigations/${mitigationId}/move`,
    {
      targetThreatId,
    },
  );
}

/** Delete a mitigation */
export function deleteMitigation(
  threatId: string,
  mitigationId: string,
): Promise<void> {
  return apiDelete(`/api/threats/${threatId}/mitigations/${mitigationId}`);
}

/** Review an AI-generated threat (accept/reject/modify) */
export function reviewThreat(
  modelId: string,
  threatId: string,
  review: {
    action: "accept" | "reject" | "modify";
    notes?: string;
    changes?: Record<string, unknown>;
  },
): Promise<Threat> {
  return apiPatch<Threat>(
    `/api/threat-models/${modelId}/threats/${threatId}/review`,
    review,
  );
}

// =============================================================================
// Threat Comments API
// =============================================================================

/** Fetch comments for a threat */
export function fetchThreatComments(
  modelId: string,
  threatId: string,
): Promise<ThreatComment[]> {
  return apiGet<ThreatComment[]>(
    `/api/threat-models/${modelId}/threats/${threatId}/comments`,
  );
}

/** Post a new comment on a threat */
export function createThreatComment(
  modelId: string,
  threatId: string,
  body: string,
): Promise<ThreatComment> {
  return apiPost<ThreatComment>(
    `/api/threat-models/${modelId}/threats/${threatId}/comments`,
    { body },
  );
}

/** Delete a comment */
export function deleteThreatComment(
  modelId: string,
  threatId: string,
  commentId: string,
): Promise<void> {
  return apiDelete(
    `/api/threat-models/${modelId}/threats/${threatId}/comments/${commentId}`,
  );
}
