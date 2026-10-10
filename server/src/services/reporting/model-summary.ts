/**
 * Reporting Service - Model Executive Summary
 */
import { getPrisma } from "../../db.js";
import {
  analyzeCompliance,
  getSupportedFrameworks,
} from "../compliance/index.js";
import type { ComplianceFramework } from "../compliance/types.js";
import type { ModelExecutiveSummary } from "./types.js";
import {
  calculateRiskDistribution,
  calculateThreatStatusDistribution,
  calculateMitigationStatusDistribution,
  getTopRisks,
  calculateModelRiskScore,
  calculateStrideAnalysis,
} from "./calculations.js";
import { generateRecommendations } from "./recommendations.js";

/** Get model executive summary. */
export async function getModelExecutiveSummary(
  modelId: string,
  frameworks?: ComplianceFramework[],
): Promise<ModelExecutiveSummary> {
  const prisma = await getPrisma();

  const model = await prisma.threatModel.findUnique({
    where: { id: modelId },
    include: {
      project: { include: { organization: true } },
      threats: { include: { mitigations: true } },
    },
  });

  if (!model) {
    throw new Error(`Threat model not found: ${modelId}`);
  }

  let componentCount = 0;
  let connectionCount = 0;
  try {
    const canvasState = JSON.parse(model.canvasState || "{}");
    componentCount = (canvasState.nodes || []).length;
    connectionCount = (canvasState.edges || []).length;
  } catch {
    // Ignore parse errors
  }

  const threats = model.threats;
  const mitigations = threats.flatMap((t) => t.mitigations);

  const threatData = threats.map((t) => ({
    id: t.id,
    name: t.name,
    severity: t.severity,
    status: t.status,
    strideCategories: t.strideCategories,
    createdAt: t.createdAt,
    mitigations: t.mitigations,
    threatModelId: model.id,
    threatModelName: model.name,
  }));

  const riskDistribution = calculateRiskDistribution(threatData);
  const threatStatus = calculateThreatStatusDistribution(threatData);
  const mitigationStatus = calculateMitigationStatusDistribution(mitigations);
  const topRisks = getTopRisks(threatData, 5);
  const strideAnalysis = calculateStrideAnalysis(threats);
  const riskScore = calculateModelRiskScore(threats);

  const frameworksToCheck = frameworks || getSupportedFrameworks();

  // Run all compliance analyses in parallel — was serial (12 sequential DB round-trips)
  const complianceScores = (
    await Promise.all(
      frameworksToCheck.map(async (framework) => {
        try {
          const analysis = await analyzeCompliance(modelId, framework);
          return {
            framework,
            score: analysis.overallScore,
            gaps: analysis.summary.criticalGaps + analysis.summary.highGaps,
          };
        } catch {
          return null; // skip frameworks that fail
        }
      }),
    )
  ).filter((s): s is NonNullable<typeof s> => s !== null);

  const recommendations = generateRecommendations(
    threats,
    mitigations,
    riskDistribution,
    complianceScores,
  );

  return {
    modelId,
    modelName: model.name,
    projectName: model.project.name,
    organizationName: model.project.organization.name,
    generatedAt: new Date().toISOString(),
    summary: {
      totalThreats: threats.length,
      totalMitigations: mitigations.length,
      riskScore: Math.round(riskScore * 10) / 10,
      componentCount,
      connectionCount,
    },
    riskDistribution,
    threatStatus,
    mitigationStatus,
    strideAnalysis,
    topRisks,
    complianceScores,
    recommendations,
  };
}
