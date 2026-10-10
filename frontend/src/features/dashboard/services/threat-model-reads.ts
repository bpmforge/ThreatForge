import { apiGet } from "@/lib/api-client";
import type {
  ThreatModelSummary,
  ThreatModelFull,
  DashboardFilters,
  ThreatModelStats,
} from "../types";

interface RawThreatModel {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
  projectId?: string;
  project?: { id: string };
  threatCount?: number;
  openThreatCount?: number;
  mitigatedThreatCount?: number;
  criticalThreatCount?: number;
  highThreatCount?: number;
  _count?: { threats: number };
}

/** Get threat models with optional filters */
export async function getThreatModels(
  filters?: DashboardFilters,
): Promise<ThreatModelSummary[]> {
  const params = new URLSearchParams();
  if (filters?.organizationId)
    params.set("organizationId", filters.organizationId);
  if (filters?.projectId) params.set("projectId", filters.projectId);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.sortBy) params.set("sortBy", filters.sortBy);
  if (filters?.sortOrder) params.set("sortOrder", filters.sortOrder);

  const queryString = params.toString();
  const url = `/api/threat-models${queryString ? `?${queryString}` : ""}`;

  // Paginated responses ({ data, pagination }) come back as-is from the client
  const result = await apiGet<RawThreatModel[] | { data?: RawThreatModel[] }>(
    url,
  );
  const models = Array.isArray(result) ? result : (result.data ?? []);

  return models.map((model) => ({
    id: model.id,
    name: model.name,
    version: model.version,
    threatCount: model.threatCount ?? model._count?.threats ?? 0,
    openThreatCount: model.openThreatCount ?? 0,
    mitigatedThreatCount: model.mitigatedThreatCount ?? 0,
    criticalThreatCount: model.criticalThreatCount ?? 0,
    highThreatCount: model.highThreatCount ?? 0,
    lastModified: model.updatedAt,
    projectId: model.projectId ?? model.project?.id ?? "",
  }));
}

/** Get a single threat model with full canvas state */
export async function getThreatModel(id: string): Promise<ThreatModelFull> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = await apiGet<any>(`/api/threat-models/${id}`);

  let tags: string[] = [];
  if (model.tags) {
    tags = typeof model.tags === "string" ? JSON.parse(model.tags) : model.tags;
  }

  return {
    id: model.id,
    name: model.name,
    version: model.version,
    status: model.status,
    tags,
    threatCount: model.threats?.length ?? 0,
    openThreatCount:
      model.threats?.filter((t: { status: string }) => t.status === "OPEN")
        .length ?? 0,
    lastModified: model.updatedAt,
    projectId: model.projectId ?? "",
    projectName: model.projectName,
    project: model.project,
    canvasState: model.canvasState,
  };
}

/** Get detailed stats for a specific threat model including STRIDE breakdown */
export async function getThreatModelStats(
  id: string,
): Promise<ThreatModelStats> {
  return apiGet<ThreatModelStats>(`/api/threat-models/${id}/stats`);
}
