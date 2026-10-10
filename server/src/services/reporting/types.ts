/**
 * Executive Reporting Types
 *
 * Types for executive dashboards and reports.
 */

/** Report time period */
export type ReportPeriod = "7d" | "30d" | "90d" | "1y" | "all";

/** Risk level distribution */
export interface RiskDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

/** Threat status distribution */
export interface ThreatStatusDistribution {
  open: number;
  inProgress: number;
  mitigated: number;
  accepted: number;
  transferred: number;
  closed: number;
}

/** Mitigation status distribution */
export interface MitigationStatusDistribution {
  notImplemented: number;
  implemented: number;
  verified: number;
  required: number;
  recommended: number;
}

/** Trend data point */
interface TrendDataPoint {
  date: string;
  value: number;
}

/** Threat trends */
export interface ThreatTrends {
  newThreats: TrendDataPoint[];
  mitigatedThreats: TrendDataPoint[];
  openThreats: TrendDataPoint[];
}

/** Top risk item */
export interface TopRiskItem {
  id: string;
  name: string;
  modelId: string;
  modelName: string;
  severity: string;
  status: string;
  strideCategories: string[];
  daysSinceCreated: number;
}

/** Model summary */
export interface ModelSummary {
  id: string;
  name: string;
  projectName: string;
  threatCount: number;
  mitigationCount: number;
  riskScore: number;
  complianceScore?: number;
  lastUpdated: string;
}

/** Organization dashboard */
export interface OrganizationDashboard {
  organizationId: string;
  organizationName: string;
  generatedAt: string;
  period: ReportPeriod;
  summary: {
    totalProjects: number;
    totalModels: number;
    totalThreats: number;
    totalMitigations: number;
    averageRiskScore: number;
    averageComplianceScore: number;
  };
  riskDistribution: RiskDistribution;
  threatStatus: ThreatStatusDistribution;
  mitigationStatus: MitigationStatusDistribution;
  trends: ThreatTrends;
  topRisks: TopRiskItem[];
  modelSummaries: ModelSummary[];
  complianceOverview: {
    framework: string;
    score: number;
    gaps: number;
  }[];
  programHealth: {
    meanTimeToMitigate: number;
    mitigationVelocity: number;
    threatDiscoveryRate: number;
    /** Reviewer throughput — % of AI threats no longer PENDING. NOT a quality metric. */
    reviewRate: number;
    /** % of AI threats ACCEPTED (subset of reviewRate). */
    reviewRateAccepted: number;
    /** % of AI threats REJECTED (subset of reviewRate). */
    reviewRateRejected: number;
    /**
     * AI precision proxy: % of REVIEWED AI threats the human kept
     * (ACCEPTED or MODIFIED). `null` when nothing has been reviewed yet —
     * render that as "no data", never as 0%.
     */
    aiPrecision: number | null;
    /** Denominator behind aiPrecision, so the UI can show confidence in it. */
    aiReviewedCount: number;
  };
}

/** Project dashboard */
export interface ProjectDashboard {
  projectId: string;
  projectName: string;
  organizationName: string;
  generatedAt: string;
  period: ReportPeriod;
  summary: {
    totalModels: number;
    totalThreats: number;
    totalMitigations: number;
    averageRiskScore: number;
  };
  riskDistribution: RiskDistribution;
  threatStatus: ThreatStatusDistribution;
  mitigationStatus: MitigationStatusDistribution;
  trends: ThreatTrends;
  topRisks: TopRiskItem[];
  modelSummaries: ModelSummary[];
}

/** Model executive summary */
export interface ModelExecutiveSummary {
  modelId: string;
  modelName: string;
  projectName: string;
  organizationName: string;
  generatedAt: string;
  summary: {
    totalThreats: number;
    totalMitigations: number;
    riskScore: number;
    componentCount: number;
    connectionCount: number;
  };
  riskDistribution: RiskDistribution;
  threatStatus: ThreatStatusDistribution;
  mitigationStatus: MitigationStatusDistribution;
  strideAnalysis: {
    category: string;
    count: number;
    mitigated: number;
  }[];
  topRisks: TopRiskItem[];
  complianceScores: {
    framework: string;
    score: number;
    gaps: number;
  }[];
  recommendations: string[];
}
