/**
 * Business Context Risk Calculator (A23)
 *
 * Pure functions — no DB access. Called from:
 *  - Threat PATCH handler (single threat recalculation)
 *  - Business context PUT handler (bulk model recalculation)
 *  - AI job completion handler (new AI-generated threats)
 *
 * Formula:
 *   TechnicalRisk  = (severityScore × 0.6) + (likelihoodScore × 0.4)
 *   BusinessRisk   = min(TechnicalRisk × BusinessMultiplier, 30)
 *
 * Tier boundaries (< exclusive):
 *   0–7   = LOW
 *   7–14  = MEDIUM
 *   14–21 = HIGH
 *   21–30 = CRITICAL
 */

export interface BusinessContext {
  businessImpact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
  dataClassification:
    | "PUBLIC"
    | "INTERNAL"
    | "CONFIDENTIAL"
    | "RESTRICTED"
    | null;
  /** Regulatory framework strings, e.g. ['HIPAA', 'PCI_DSS'] */
  regulatoryScope: string[];
  userBase: "INTERNAL" | "CUSTOMERS" | "PUBLIC" | null;
  revenueImpact: "NONE" | "INDIRECT" | "DIRECT" | "PRIMARY" | null;
}

export interface BusinessRiskResult {
  technicalRisk: number;
  businessMultiplier: number;
  businessRisk: number;
  businessRiskTier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

const SEVERITY_SCORES: Record<string, number> = {
  CRITICAL: 10,
  HIGH: 7.5,
  MEDIUM: 5,
  LOW: 2.5,
  INFO: 1,
};

const IMPACT_WEIGHTS: Record<string, number> = {
  CRITICAL: 2.0,
  HIGH: 1.5,
  MEDIUM: 1.0,
  LOW: 0.7,
};

const CLASSIFICATION_WEIGHTS: Record<string, number> = {
  RESTRICTED: 1.5,
  CONFIDENTIAL: 1.25,
  INTERNAL: 1.0,
  PUBLIC: 0.75,
};

/** Returns null when context is null (not configured). */
export function calculateBusinessRisk(
  severity: string,
  likelihood: number | null,
  context: BusinessContext | null,
): BusinessRiskResult | null {
  if (context === null) return null;

  const severityScore = SEVERITY_SCORES[severity] ?? 5; // default MEDIUM if unknown
  const likelihoodScore = likelihood ?? 0.5; // default mid-range when unset

  const technicalRisk = severityScore * 0.6 + likelihoodScore * 0.4;

  const impactWeight = IMPACT_WEIGHTS[context.businessImpact ?? ""] ?? 1.0;
  const classificationWeight =
    CLASSIFICATION_WEIGHTS[context.dataClassification ?? ""] ?? 1.0;

  // RegulatoryWeight: 1.3 if scope has entries that are not 'NONE', else 1.0
  const hasRegulation =
    context.regulatoryScope.length > 0 &&
    !context.regulatoryScope.every((s) => s === "NONE");
  const regulatoryWeight = hasRegulation ? 1.3 : 1.0;

  const businessMultiplier =
    impactWeight * classificationWeight * regulatoryWeight;
  const businessRisk = Math.min(technicalRisk * businessMultiplier, 30);

  return {
    technicalRisk,
    businessMultiplier,
    businessRisk,
    businessRiskTier: toRiskTier(businessRisk),
  };
}

/** Convert a numeric business risk score (0–30) to a tier label. */
export function toRiskTier(
  score: number,
): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score < 7) return "LOW";
  if (score < 14) return "MEDIUM";
  if (score < 21) return "HIGH";
  return "CRITICAL";
}
