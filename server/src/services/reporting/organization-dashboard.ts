/**
 * Reporting Service - Organization Dashboard
 */
import { getPrisma } from "../../db.js";
import {
  analyzeCompliance,
  getSupportedFrameworks,
} from "../compliance/index.js";
import type {
  ReportPeriod,
  ModelSummary,
  OrganizationDashboard,
} from "./types.js";
import {
  getPeriodStart,
  calculateRiskDistribution,
  calculateThreatStatusDistribution,
  calculateMitigationStatusDistribution,
  calculateTrends,
  getTopRisks,
  calculateModelRiskScore,
} from "./calculations.js";

/** Get organization-wide dashboard. */
export async function getOrganizationDashboard(
  organizationId: string,
  period: ReportPeriod = "30d",
): Promise<OrganizationDashboard> {
  const prisma = await getPrisma();
  const periodStart = getPeriodStart(period);

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      projects: {
        include: {
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
                  reviewStatus: true,
                  createdAt: true,
                  mitigations: {
                    select: { status: true, updatedAt: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!org) {
    throw new Error(`Organization not found: ${organizationId}`);
  }

  const allThreats: Array<{
    id: string;
    name: string;
    severity: string;
    status: string;
    strideCategories: string;
    reviewStatus: string;
    createdAt: Date;
    mitigations: Array<{ status: string; updatedAt: Date }>;
    threatModelId: string;
    threatModelName: string;
  }> = [];

  const allMitigations: Array<{ status: string; updatedAt: Date }> = [];
  const modelSummaries: ModelSummary[] = [];

  for (const project of org.projects) {
    for (const model of project.threatModels) {
      const modelThreats = model.threats;
      const modelMitigations = modelThreats.flatMap((t) => t.mitigations);

      for (const threat of modelThreats) {
        const t = threat as typeof threat & { reviewStatus?: string };
        allThreats.push({
          ...threat,
          reviewStatus: t.reviewStatus ?? "PENDING",
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
  }

  const riskDistribution = calculateRiskDistribution(allThreats);
  const threatStatus = calculateThreatStatusDistribution(allThreats);
  const mitigationStatus =
    calculateMitigationStatusDistribution(allMitigations);
  const trends = calculateTrends(allThreats, periodStart);
  const topRisks = getTopRisks(allThreats, 10);

  const complianceOverview: {
    framework: string;
    score: number;
    gaps: number;
  }[] = [];
  if (modelSummaries.length > 0) {
    const frameworks = getSupportedFrameworks();
    for (const framework of frameworks.slice(0, 3)) {
      try {
        const analysis = await analyzeCompliance(
          modelSummaries[0].id,
          framework,
        );
        complianceOverview.push({
          framework,
          score: analysis.overallScore,
          gaps: analysis.summary.criticalGaps + analysis.summary.highGaps,
        });
      } catch {
        // Skip if analysis fails
      }
    }
  }

  // Program health metrics
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const completedMitigations = allMitigations.filter(
    (m) => m.status === "IMPLEMENTED",
  );

  // Mean time to mitigate: avg days from threat created → first COMPLETED mitigation
  const mitigationTimes: number[] = [];
  for (const threat of allThreats) {
    const completed = threat.mitigations.filter(
      (m) => m.status === "IMPLEMENTED",
    );
    if (completed.length > 0) {
      const earliest = completed.reduce((a, b) =>
        a.updatedAt < b.updatedAt ? a : b,
      );
      const days =
        (earliest.updatedAt.getTime() - threat.createdAt.getTime()) /
        (1000 * 60 * 60 * 24);
      if (days >= 0) mitigationTimes.push(days);
    }
  }
  const meanTimeToMitigate =
    mitigationTimes.length > 0
      ? Math.round(
          mitigationTimes.reduce((a, b) => a + b, 0) / mitigationTimes.length,
        )
      : 0;

  // Mitigation velocity: completed mitigations in last 4 weeks ÷ 4
  const recentlyCompleted = completedMitigations.filter(
    (m) => m.updatedAt >= fourWeeksAgo,
  ).length;
  const mitigationVelocity = Math.round((recentlyCompleted / 4) * 10) / 10;

  // Threat discovery rate: new threats in last 4 weeks ÷ 4
  const recentThreats = allThreats.filter(
    (t) => t.createdAt >= fourWeeksAgo,
  ).length;
  const threatDiscoveryRate = Math.round((recentThreats / 4) * 10) / 10;

  // Review rate: % of AI_SUGGESTED threats that are no longer PENDING.
  // NOTE: this measures reviewer THROUGHPUT, not AI quality — an ACCEPTED and a
  // REJECTED threat count identically here. For quality, see aiPrecision below.
  const aiSuggested = allThreats.filter((t) => t.reviewStatus !== undefined);
  const reviewed = aiSuggested.filter((t) => t.reviewStatus !== "PENDING");
  const reviewRate =
    aiSuggested.length > 0
      ? Math.round((reviewed.length / aiSuggested.length) * 100)
      : 100;

  // Split the review rate by outcome so "reviewed" is not read as "right".
  // MODIFIED is neither: the reviewer kept the finding but reworded it.
  const pct = (n: number) =>
    aiSuggested.length > 0 ? Math.round((n / aiSuggested.length) * 100) : 0;
  const reviewRateAccepted = pct(
    aiSuggested.filter((t) => t.reviewStatus === "ACCEPTED").length,
  );
  const reviewRateRejected = pct(
    aiSuggested.filter((t) => t.reviewStatus === "REJECTED").length,
  );

  // AI precision proxy: of the AI threats a human actually ruled on, what share
  // did they keep? This is the first metric in the product that moves when the
  // AI gets better or worse. MODIFIED counts as kept — the finding was real,
  // the wording needed work.
  //
  // Caveats, deliberately explicit: it only covers reviewed threats (selection
  // bias — reviewers may triage obvious junk first), and it measures agreement
  // with the reviewer rather than ground truth. It is a leading indicator, not
  // an evaluation. `null` when nobody has reviewed anything yet — do NOT render
  // that as 0%, which would read as "the AI is always wrong".
  const decided = aiSuggested.filter(
    (t) =>
      t.reviewStatus === "ACCEPTED" ||
      t.reviewStatus === "REJECTED" ||
      t.reviewStatus === "MODIFIED",
  );
  const kept = decided.filter(
    (t) => t.reviewStatus === "ACCEPTED" || t.reviewStatus === "MODIFIED",
  );
  const aiPrecision =
    decided.length > 0
      ? Math.round((kept.length / decided.length) * 100)
      : null;
  const aiReviewedCount = decided.length;

  const averageRiskScore =
    modelSummaries.length > 0
      ? modelSummaries.reduce((sum, m) => sum + m.riskScore, 0) /
        modelSummaries.length
      : 0;

  const averageComplianceScore =
    complianceOverview.length > 0
      ? complianceOverview.reduce((sum, c) => sum + c.score, 0) /
        complianceOverview.length
      : 0;

  return {
    organizationId,
    organizationName: org.name,
    generatedAt: new Date().toISOString(),
    period,
    summary: {
      totalProjects: org.projects.length,
      totalModels: modelSummaries.length,
      totalThreats: allThreats.length,
      totalMitigations: allMitigations.length,
      averageRiskScore: Math.round(averageRiskScore * 10) / 10,
      averageComplianceScore: Math.round(averageComplianceScore),
    },
    riskDistribution,
    threatStatus,
    mitigationStatus,
    trends,
    topRisks,
    modelSummaries: modelSummaries.slice(0, 10),
    complianceOverview,
    programHealth: {
      meanTimeToMitigate,
      mitigationVelocity,
      threatDiscoveryRate,
      reviewRate,
      reviewRateAccepted,
      reviewRateRejected,
      aiPrecision,
      aiReviewedCount,
    },
  };
}
