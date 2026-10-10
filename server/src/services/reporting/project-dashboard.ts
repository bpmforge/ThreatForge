/**
 * Reporting Service - Project Dashboard
 */
import { getPrisma } from "../../db.js";
import type { ReportPeriod, ModelSummary, ProjectDashboard } from "./types.js";
import {
  getPeriodStart,
  calculateRiskDistribution,
  calculateThreatStatusDistribution,
  calculateMitigationStatusDistribution,
  calculateTrends,
  getTopRisks,
  calculateModelRiskScore,
} from "./calculations.js";

/** Get project-level dashboard. */
export async function getProjectDashboard(
  projectId: string,
  period: ReportPeriod = "30d",
): Promise<ProjectDashboard> {
  const prisma = await getPrisma();
  const periodStart = getPeriodStart(period);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      organization: { select: { name: true } },
      threatModels: {
        // Perf: select only needed fields — canvasState/collaborationState can be MBs each
        select: {
          id: true,
          name: true,
          updatedAt: true,
          threats: {
            select: {
              id: true,
              name: true,
              severity: true,
              status: true,
              strideCategories: true,
              createdAt: true,
              mitigations: {
                select: { status: true },
              },
            },
          },
        },
      },
    },
  });

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const allThreats: Array<{
    id: string;
    name: string;
    severity: string;
    status: string;
    strideCategories: string;
    createdAt: Date;
    mitigations: Array<{ status: string }>;
    threatModelId: string;
    threatModelName: string;
  }> = [];

  const allMitigations: Array<{ status: string }> = [];
  const modelSummaries: ModelSummary[] = [];

  for (const model of project.threatModels) {
    const modelThreats = model.threats;
    const modelMitigations = modelThreats.flatMap((t) => t.mitigations);

    for (const threat of modelThreats) {
      allThreats.push({
        ...threat,
        threatModelId: model.id,
        threatModelName: model.name,
      });
    }

    allMitigations.push(...modelMitigations);
    const riskScore = calculateModelRiskScore(modelThreats);

    modelSummaries.push({
      id: model.id,
      name: model.name,
      projectName: project.name,
      threatCount: modelThreats.length,
      mitigationCount: modelMitigations.length,
      riskScore,
      lastUpdated: model.updatedAt.toISOString(),
    });
  }

  const riskDistribution = calculateRiskDistribution(allThreats);
  const threatStatus = calculateThreatStatusDistribution(allThreats);
  const mitigationStatus =
    calculateMitigationStatusDistribution(allMitigations);
  const trends = calculateTrends(allThreats, periodStart);
  const topRisks = getTopRisks(allThreats, 10);

  const averageRiskScore =
    modelSummaries.length > 0
      ? modelSummaries.reduce((sum, m) => sum + m.riskScore, 0) /
        modelSummaries.length
      : 0;

  return {
    projectId,
    projectName: project.name,
    organizationName: project.organization.name,
    generatedAt: new Date().toISOString(),
    period,
    summary: {
      totalModels: modelSummaries.length,
      totalThreats: allThreats.length,
      totalMitigations: allMitigations.length,
      averageRiskScore: Math.round(averageRiskScore * 10) / 10,
    },
    riskDistribution,
    threatStatus,
    mitigationStatus,
    trends,
    topRisks,
    modelSummaries,
  };
}
