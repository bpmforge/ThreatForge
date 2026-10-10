/**
 * Compliance Gap Analysis Service
 *
 * Analyzes threat models against compliance frameworks to identify gaps.
 */

import { getPrisma } from "../../db.js";
import {
  getFrameworkCategories,
  getFrameworkControls,
  getFrameworkDisplayName,
} from "./frameworks/index.js";
import type {
  ComplianceFramework,
  ControlStatus,
  ComplianceControl,
  ControlAssessment,
  CategoryAssessment,
  ComplianceAnalysis,
  GapReport,
} from "./types.js";

/**
 * Analyze a threat model against a compliance framework.
 */
export async function analyzeCompliance(
  modelId: string,
  framework: ComplianceFramework,
): Promise<ComplianceAnalysis> {
  const prisma = await getPrisma();

  // Fetch threat model with threats and mitigations
  const model = await prisma.threatModel.findUnique({
    where: { id: modelId },
    include: {
      threats: {
        include: {
          mitigations: true,
        },
      },
    },
  });

  if (!model) {
    throw new Error(`Threat model not found: ${modelId}`);
  }

  // Get framework controls
  const categories = getFrameworkCategories(framework);
  const controls = getFrameworkControls(framework);

  if (controls.length === 0) {
    throw new Error(`Framework not supported: ${framework}`);
  }

  // Extract text from threats and mitigations for matching
  const threatTexts = model.threats.map((t) => {
    // Parse strideCategories from JSON string
    let strideCategories: string[] = [];
    try {
      strideCategories = JSON.parse(t.strideCategories || "[]");
    } catch {
      strideCategories = [];
    }

    return {
      id: t.id,
      text: `${t.name} ${t.description || ""}`.toLowerCase(),
      strideCategories,
      status: t.status,
      mitigations: t.mitigations.map((m) => ({
        id: m.id,
        text: `${m.description || ""}`.toLowerCase(),
        status: m.status,
      })),
    };
  });

  // Assess each control
  const controlAssessments = controls.map((control) =>
    assessControl(control, threatTexts),
  );

  // Group assessments by category
  const categoryAssessments: CategoryAssessment[] = categories.map(
    (category) => {
      const categoryControls = controlAssessments.filter(
        (ca) => ca.control.category === category.id,
      );

      const summary = {
        total: categoryControls.length,
        notAddressed: categoryControls.filter(
          (c) => c.status === "NOT_ADDRESSED",
        ).length,
        partiallyAddressed: categoryControls.filter(
          (c) => c.status === "PARTIALLY_ADDRESSED",
        ).length,
        fullyAddressed: categoryControls.filter(
          (c) => c.status === "FULLY_ADDRESSED",
        ).length,
        notApplicable: categoryControls.filter(
          (c) => c.status === "NOT_APPLICABLE",
        ).length,
      };

      const applicableControls = summary.total - summary.notApplicable;
      const coverage =
        applicableControls > 0
          ? Math.round(
              ((summary.fullyAddressed + summary.partiallyAddressed * 0.5) /
                applicableControls) *
                100,
            )
          : 100;

      // Determine category status
      let status: ControlStatus = "NOT_ADDRESSED";
      if (summary.fullyAddressed === applicableControls) {
        status = "FULLY_ADDRESSED";
      } else if (summary.fullyAddressed + summary.partiallyAddressed > 0) {
        status = "PARTIALLY_ADDRESSED";
      }

      return {
        category,
        controls: categoryControls,
        status,
        summary,
        coverage,
      };
    },
  );

  // Calculate overall statistics
  const totalControls = controlAssessments.length;
  const notAddressed = controlAssessments.filter(
    (c) => c.status === "NOT_ADDRESSED",
  ).length;
  const partiallyAddressed = controlAssessments.filter(
    (c) => c.status === "PARTIALLY_ADDRESSED",
  ).length;
  const fullyAddressed = controlAssessments.filter(
    (c) => c.status === "FULLY_ADDRESSED",
  ).length;
  const notApplicable = controlAssessments.filter(
    (c) => c.status === "NOT_APPLICABLE",
  ).length;

  // Count gaps by severity
  const gaps = controlAssessments.filter(
    (c) => c.status !== "FULLY_ADDRESSED" && c.status !== "NOT_APPLICABLE",
  );
  const criticalGaps = gaps.filter(
    (c) => c.control.severity === "CRITICAL",
  ).length;
  const highGaps = gaps.filter((c) => c.control.severity === "HIGH").length;
  const mediumGaps = gaps.filter((c) => c.control.severity === "MEDIUM").length;
  const lowGaps = gaps.filter((c) => c.control.severity === "LOW").length;

  // Calculate overall score
  const applicableControls = totalControls - notApplicable;
  const overallScore =
    applicableControls > 0
      ? Math.round(
          ((fullyAddressed + partiallyAddressed * 0.5) / applicableControls) *
            100,
        )
      : 100;

  // Determine overall status
  let overallStatus: ControlStatus = "NOT_ADDRESSED";
  if (fullyAddressed === applicableControls) {
    overallStatus = "FULLY_ADDRESSED";
  } else if (fullyAddressed + partiallyAddressed > 0) {
    overallStatus = "PARTIALLY_ADDRESSED";
  }

  // Get top gaps (sorted by severity)
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const topGaps = gaps
    .sort(
      (a, b) =>
        severityOrder[a.control.severity] - severityOrder[b.control.severity],
    )
    .slice(0, 10);

  return {
    modelId,
    modelName: model.name,
    framework,
    analyzedAt: new Date().toISOString(),
    overallScore,
    overallStatus,
    summary: {
      totalControls,
      notAddressed,
      partiallyAddressed,
      fullyAddressed,
      notApplicable,
      criticalGaps,
      highGaps,
      mediumGaps,
      lowGaps,
    },
    categories: categoryAssessments,
    topGaps,
  };
}

/**
 * Assess a single control against threat model content.
 */
function assessControl(
  control: ComplianceControl,
  threatTexts: Array<{
    id: string;
    text: string;
    strideCategories: string[];
    status: string;
    mitigations: Array<{ id: string; text: string; status: string }>;
  }>,
): ControlAssessment {
  const addressingThreats: string[] = [];
  const addressingMitigations: string[] = [];
  let keywordMatches = 0;
  let strideMatches = 0;

  for (const threat of threatTexts) {
    // Check keyword matches
    const keywordMatch = control.keywords.some((keyword) =>
      threat.text.includes(keyword.toLowerCase()),
    );

    // Check STRIDE category matches
    const strideMatch = control.strideCategories.some((stride) =>
      threat.strideCategories.includes(stride),
    );

    if (keywordMatch || strideMatch) {
      addressingThreats.push(threat.id);
      if (keywordMatch) keywordMatches++;
      if (strideMatch) strideMatches++;

      // Check mitigations
      for (const mitigation of threat.mitigations) {
        const mitigationKeywordMatch = control.keywords.some((keyword) =>
          mitigation.text.includes(keyword.toLowerCase()),
        );
        if (mitigationKeywordMatch) {
          addressingMitigations.push(mitigation.id);
        }
      }
    }
  }

  // Calculate coverage based on matches
  let coverage = 0;
  if (addressingThreats.length > 0) {
    // Base coverage from having threats that address this control
    coverage = 30;

    // Additional coverage from mitigations
    if (addressingMitigations.length > 0) {
      coverage += 40;
    }

    // Additional coverage from multiple keyword matches
    if (keywordMatches >= 2) {
      coverage += 15;
    }

    // Additional coverage from STRIDE alignment
    if (strideMatches > 0) {
      coverage += 15;
    }
  }

  coverage = Math.min(100, coverage);

  // Determine status
  let status: ControlStatus;
  if (coverage >= 80) {
    status = "FULLY_ADDRESSED";
  } else if (coverage >= 30) {
    status = "PARTIALLY_ADDRESSED";
  } else {
    status = "NOT_ADDRESSED";
  }

  // Generate gap description and recommendations
  const gap =
    status !== "FULLY_ADDRESSED"
      ? generateGapDescription(control, coverage, addressingThreats.length)
      : undefined;

  const recommendations =
    status !== "FULLY_ADDRESSED"
      ? generateRecommendations(control, coverage, addressingMitigations.length)
      : [];

  return {
    control,
    status,
    addressingThreats,
    addressingMitigations,
    coverage,
    gap,
    recommendations,
  };
}

/**
 * Generate gap description.
 */
function generateGapDescription(
  control: ComplianceControl,
  coverage: number,
  threatCount: number,
): string {
  if (coverage === 0) {
    return `No threats or mitigations address ${control.name}. This control requires attention to ensure compliance.`;
  }

  if (threatCount === 0) {
    return `${control.name} is not covered by any identified threats. Consider adding threats related to: ${control.keywords.slice(0, 3).join(", ")}.`;
  }

  return `${control.name} is only partially addressed (${coverage}% coverage). Additional mitigations may be needed.`;
}

/**
 * Generate recommendations for addressing gaps.
 */
function generateRecommendations(
  control: ComplianceControl,
  coverage: number,
  mitigationCount: number,
): string[] {
  const recommendations: string[] = [];

  if (coverage === 0) {
    recommendations.push(
      `Add threats related to ${control.name} to your threat model.`,
    );
    recommendations.push(
      `Consider STRIDE categories: ${control.strideCategories.join(", ")}.`,
    );
  }

  if (mitigationCount === 0) {
    recommendations.push(
      `Define mitigations that address ${control.keywords.slice(0, 3).join(", ")}.`,
    );
  }

  if (control.severity === "CRITICAL" || control.severity === "HIGH") {
    recommendations.push(
      `This is a ${control.severity.toLowerCase()}-severity control. Prioritize addressing this gap.`,
    );
  }

  // Add control-specific recommendations
  recommendations.push(`Review ${control.description}`);

  return recommendations.slice(0, 4);
}

/**
 * Generate a gap report for export.
 */
export async function generateGapReport(
  modelId: string,
  framework: ComplianceFramework,
): Promise<GapReport> {
  const analysis = await analyzeCompliance(modelId, framework);

  // Generate executive summary
  const executiveSummary = generateExecutiveSummary(analysis);

  // Map gaps to report format
  const gaps = analysis.topGaps.map((ca) => ({
    controlId: ca.control.id,
    controlName: ca.control.name,
    category: ca.control.category,
    severity: ca.control.severity,
    gap: ca.gap || "Gap not specified",
    recommendations: ca.recommendations,
    effort: estimateEffort(ca),
  }));

  // Generate overall recommendations
  const recommendations = generateOverallRecommendations(analysis);

  return {
    modelId: analysis.modelId,
    modelName: analysis.modelName,
    framework,
    generatedAt: new Date().toISOString(),
    executiveSummary,
    overallScore: analysis.overallScore,
    gaps,
    recommendations,
  };
}

/**
 * Generate executive summary.
 */
function generateExecutiveSummary(analysis: ComplianceAnalysis): string {
  const frameworkName = getFrameworkDisplayName(analysis.framework);
  const { summary, overallScore } = analysis;

  let riskLevel = "low";
  if (overallScore < 50) riskLevel = "high";
  else if (overallScore < 75) riskLevel = "moderate";

  const criticalNote =
    summary.criticalGaps > 0
      ? ` There are ${summary.criticalGaps} critical gaps requiring immediate attention.`
      : "";

  return `This ${frameworkName} compliance analysis for "${analysis.modelName}" shows an overall compliance score of ${overallScore}%. The current risk level is ${riskLevel}. Of ${summary.totalControls} controls assessed, ${summary.fullyAddressed} are fully addressed, ${summary.partiallyAddressed} are partially addressed, and ${summary.notAddressed} are not addressed.${criticalNote}`;
}

/**
 * Estimate effort to address a gap.
 */
function estimateEffort(
  assessment: ControlAssessment,
): "LOW" | "MEDIUM" | "HIGH" {
  const { coverage, control } = assessment;

  // Higher coverage = less effort needed
  if (coverage >= 50) return "LOW";
  if (coverage >= 20) return "MEDIUM";

  // Critical/high severity typically requires more effort
  if (control.severity === "CRITICAL") return "HIGH";
  if (control.severity === "HIGH") return "MEDIUM";

  return "MEDIUM";
}

/**
 * Generate overall recommendations.
 */
function generateOverallRecommendations(
  analysis: ComplianceAnalysis,
): string[] {
  const recommendations: string[] = [];
  const { summary } = analysis;

  if (summary.criticalGaps > 0) {
    recommendations.push(
      `Address ${summary.criticalGaps} critical control gaps as highest priority.`,
    );
  }

  if (summary.highGaps > 0) {
    recommendations.push(
      `Review and remediate ${summary.highGaps} high-severity gaps within the next sprint.`,
    );
  }

  if (summary.notAddressed > summary.totalControls * 0.3) {
    recommendations.push(
      "Significant compliance gaps exist. Consider a comprehensive threat modeling review.",
    );
  }

  // Category-specific recommendations
  const weakCategories = analysis.categories
    .filter((c) => c.coverage < 50)
    .sort((a, b) => a.coverage - b.coverage)
    .slice(0, 3);

  for (const category of weakCategories) {
    recommendations.push(
      `Focus on ${category.category.name} (${category.coverage}% coverage) to improve overall compliance.`,
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Continue maintaining current security controls and perform regular reviews.",
    );
  }

  return recommendations.slice(0, 5);
}

/**
 * Compare compliance across multiple frameworks.
 */
export async function compareFrameworks(
  modelId: string,
  frameworks: ComplianceFramework[],
): Promise<
  Array<{ framework: ComplianceFramework; score: number; gaps: number }>
> {
  const results = await Promise.all(
    frameworks.map(async (framework) => {
      try {
        const analysis = await analyzeCompliance(modelId, framework);
        return {
          framework,
          score: analysis.overallScore,
          gaps: analysis.summary.criticalGaps + analysis.summary.highGaps,
        };
      } catch {
        return {
          framework,
          score: 0,
          gaps: 0,
        };
      }
    }),
  );

  return results;
}
