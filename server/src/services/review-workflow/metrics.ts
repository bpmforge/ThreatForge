/**
 * Review Workflow Service - Metrics and Activity
 */

import { getPrisma } from "../../db.js";
import type {
  ReviewMetrics,
  ReviewActivity,
  ReviewActivityAction,
} from "./types.js";
import { DEFAULT_REVIEW_CRITERIA } from "./types.js";

/** Calculate review metrics for a threat model. */
export async function calculateReviewMetrics(
  threatModelId: string,
): Promise<ReviewMetrics> {
  const prisma = await getPrisma();

  // Get threats
  const threats = await prisma.threat.findMany({
    where: { threatModelId },
    include: { mitigations: true },
  });

  const openThreats = threats.filter((t) => t.status === "OPEN");
  const mitigatedThreats = threats.filter(
    (t) =>
      t.status === "MITIGATED" ||
      t.mitigations.some((m) => m.status === "IMPLEMENTED"),
  );

  const criticalThreats = openThreats.filter((t) => t.severity === "CRITICAL");
  const highThreats = openThreats.filter((t) => t.severity === "HIGH");
  const mediumThreats = openThreats.filter((t) => t.severity === "MEDIUM");
  const lowThreats = openThreats.filter((t) => t.severity === "LOW");

  const mitigationCoverage =
    threats.length > 0
      ? Math.round((mitigatedThreats.length / threats.length) * 100)
      : 100;

  // Apply criteria checks
  const criteria = DEFAULT_REVIEW_CRITERIA;
  const criteriaResults: ReviewMetrics["criteriaResults"] = [];

  criteriaResults.push({
    criterion: "Critical threats within limit",
    passed: criticalThreats.length <= criteria.maxOpenCriticalThreats,
    details: `${criticalThreats.length} open critical threats (max: ${criteria.maxOpenCriticalThreats})`,
  });

  criteriaResults.push({
    criterion: "High threats within limit",
    passed: highThreats.length <= criteria.maxOpenHighThreats,
    details: `${highThreats.length} open high threats (max: ${criteria.maxOpenHighThreats})`,
  });

  criteriaResults.push({
    criterion: "Mitigation coverage",
    passed: mitigationCoverage >= criteria.minMitigationCoverage,
    details: `${mitigationCoverage}% coverage (min: ${criteria.minMitigationCoverage}%)`,
  });

  const criticalMitigated = criticalThreats.every(
    (t) => t.mitigations.length > 0 || t.status !== "OPEN",
  );
  criteriaResults.push({
    criterion: "Critical threats have mitigations",
    passed: !criteria.requireMitigationsForCritical || criticalMitigated,
    details: criticalMitigated
      ? "All critical threats have mitigations"
      : "Some critical threats lack mitigations",
  });

  const overallPassed = criteriaResults.every((r) => r.passed);

  return {
    threatModelId,
    totalThreats: threats.length,
    openThreats: {
      critical: criticalThreats.length,
      high: highThreats.length,
      medium: mediumThreats.length,
      low: lowThreats.length,
    },
    mitigationCoverage,
    complianceScores: {}, // Would be populated from compliance service
    criteriaResults,
    overallPassed,
  };
}

/** Get review activity log. */
export async function getReviewActivity(
  reviewRequestId: string,
): Promise<ReviewActivity[]> {
  const prisma = await getPrisma();

  const activities = await prisma.reviewActivity.findMany({
    where: { reviewRequestId },
    orderBy: { createdAt: "desc" },
  });

  return activities.map((a) => ({
    id: a.id,
    reviewRequestId: a.reviewRequestId,
    userId: a.userId || undefined,
    userName: a.userName || undefined,
    action: a.action as ReviewActivityAction,
    details: a.details ? JSON.parse(a.details) : undefined,
    createdAt: a.createdAt,
  }));
}
