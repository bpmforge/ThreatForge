import type { DashboardStats, RecentActivity } from "../types";
import { apiGet } from "@/lib/api-client";
import { getThreatModels } from "./threat-model-reads";

export interface ProjectRiskSummary {
  id: string;
  name: string;
  modelCount: number;
  totalThreats: number;
  openThreats: number;
  criticalThreats: number;
  mitigatedThreats: number;
}

/** Get dashboard stats - aggregated from models */
export async function getDashboardStats(
  organizationId?: string,
): Promise<DashboardStats> {
  const models = await getThreatModels(
    organizationId ? { organizationId } : undefined,
  );

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  return {
    totalModels: models.length,
    totalThreats: models.reduce((sum, m) => sum + m.threatCount, 0),
    openThreats: models.reduce((sum, m) => sum + (m.openThreatCount ?? 0), 0),
    mitigatedThreats: models.reduce(
      (sum, m) => sum + (m.mitigatedThreatCount ?? 0),
      0,
    ),
    criticalThreats: models.reduce(
      (sum, m) => sum + (m.criticalThreatCount ?? 0),
      0,
    ),
    modelsThisWeek: models.filter((m) => new Date(m.lastModified) >= oneWeekAgo)
      .length,
  };
}

/** Get recent activity - derived from models */
export async function getRecentActivity(
  organizationId?: string,
): Promise<RecentActivity[]> {
  const models = await getThreatModels({
    organizationId,
    sortBy: "lastModified",
    sortOrder: "desc",
  });

  return models.slice(0, 10).map((model) => ({
    id: model.id,
    type: "model_updated" as const,
    description: `Updated "${model.name}"`,
    modelId: model.id,
    modelName: model.name,
    timestamp: model.lastModified,
  }));
}

/** Get project risk summaries - aggregates threat data by project */
export async function getProjectsAtRisk(
  organizationId?: string,
): Promise<ProjectRiskSummary[]> {
  const models = await getThreatModels(
    organizationId ? { organizationId } : undefined,
  );

  const projectMap = new Map<string, ProjectRiskSummary>();

  for (const model of models) {
    const projectId = model.projectId || "unassigned";

    if (!projectMap.has(projectId)) {
      projectMap.set(projectId, {
        id: projectId,
        name: projectId === "unassigned" ? "Unassigned" : "",
        modelCount: 0,
        totalThreats: 0,
        openThreats: 0,
        criticalThreats: 0,
        mitigatedThreats: 0,
      });
    }

    const project = projectMap.get(projectId)!;
    project.modelCount += 1;
    project.totalThreats += model.threatCount || 0;
    project.openThreats += model.openThreatCount || 0;
    project.criticalThreats += model.criticalThreatCount || 0;
    project.mitigatedThreats += model.mitigatedThreatCount || 0;
  }

  const projectIds = Array.from(projectMap.keys()).filter(
    (id) => id !== "unassigned",
  );
  if (projectIds.length > 0) {
    try {
      const params = new URLSearchParams();
      if (organizationId) params.set("organizationId", organizationId);
      // apiGet unwraps { data }; paginated responses come back as { data, pagination }
      const result = await apiGet<
        | { id: string; name: string }[]
        | { data: { id: string; name: string }[] }
      >(`/api/projects?${params}`);
      const projects = Array.isArray(result) ? result : result.data;
      for (const proj of projects) {
        if (projectMap.has(proj.id)) {
          projectMap.get(proj.id)!.name = proj.name;
        }
      }
    } catch {
      for (const [id, project] of projectMap) {
        if (id !== "unassigned" && !project.name) {
          project.name = `Project ${id.slice(0, 8)}`;
        }
      }
    }
  }

  return Array.from(projectMap.values());
}

/**
 * Get active collaborator counts for a list of model IDs.
 * Returns a map of modelId → active user count.
 */
export async function getPresenceCounts(
  modelIds: string[],
): Promise<Record<string, number>> {
  if (modelIds.length === 0) return {};
  try {
    return await apiGet<Record<string, number>>(
      `/api/presence?modelIds=${modelIds.join(",")}`,
    );
  } catch {
    return {};
  }
}
