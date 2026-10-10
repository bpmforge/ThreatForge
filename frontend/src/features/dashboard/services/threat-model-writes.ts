import { apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import type { ThreatModelSummary, ModelStatus } from "../types";

interface RawModel {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
  projectId?: string;
  threats?: Array<{ status: string; severity: string }>;
  tags?: string[];
  status?: string;
}

function toSummary(model: RawModel): ThreatModelSummary {
  return {
    id: model.id,
    name: model.name,
    version: model.version,
    threatCount: model.threats?.length ?? 0,
    openThreatCount: 0,
    lastModified: model.updatedAt,
    projectId: model.projectId ?? "",
  };
}

/** Create a new threat model */
export async function createThreatModel(data: {
  name: string;
  projectId?: string;
}): Promise<ThreatModelSummary> {
  return toSummary(await apiPost<RawModel>("/api/threat-models", data));
}

/** Delete a threat model */
export async function deleteThreatModel(id: string): Promise<void> {
  await apiDelete(`/api/threat-models/${id}`);
}

/** Duplicate a threat model */
export async function duplicateThreatModel(
  id: string,
): Promise<ThreatModelSummary> {
  return toSummary(
    await apiPost<RawModel>(`/api/threat-models/${id}/duplicate`),
  );
}

/** Import a threat model from JSON */
export async function importThreatModel(data: {
  name: string;
  canvasState?: { nodes: unknown[]; edges: unknown[] };
  projectId?: string;
}): Promise<ThreatModelSummary> {
  return toSummary(await apiPost<RawModel>("/api/threat-models/import", data));
}

/** Move a threat model to a different project */
export async function moveThreatModelToProject(
  id: string,
  projectId: string,
): Promise<ThreatModelSummary> {
  return toSummary(
    await apiPatch<RawModel>(`/api/threat-models/${id}`, { projectId }),
  );
}

/** Update model lifecycle status */
export async function updateModelStatus(
  id: string,
  status: ModelStatus,
): Promise<{ id: string; status: ModelStatus; updatedAt: string }> {
  return apiPatch<{ id: string; status: ModelStatus; updatedAt: string }>(
    `/api/threat-models/${id}/status`,
    { status },
  );
}

/** Update model tags */
export async function updateModelTags(
  id: string,
  tags: string[],
): Promise<{ id: string; tags: string[]; updatedAt: string }> {
  return apiPatch<{ id: string; tags: string[]; updatedAt: string }>(
    `/api/threat-models/${id}/tags`,
    { tags },
  );
}
