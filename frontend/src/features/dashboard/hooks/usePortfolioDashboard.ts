/**
 * Portfolio Dashboard Hook
 *
 * Fetches org-wide risk posture from the reporting API.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";

export interface TrendDataPoint {
  date: string;
  value: number;
}

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

export interface OrganizationDashboard {
  organizationId: string;
  organizationName: string;
  generatedAt: string;
  period: string;
  summary: {
    totalProjects: number;
    totalModels: number;
    totalThreats: number;
    totalMitigations: number;
    averageRiskScore: number;
    averageComplianceScore: number;
  };
  riskDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  threatStatus: {
    open: number;
    inProgress: number;
    mitigated: number;
    accepted: number;
    closed: number;
  };
  mitigationStatus: {
    planned: number;
    inProgress: number;
    completed: number;
    verified: number;
  };
  trends: {
    newThreats: TrendDataPoint[];
    mitigatedThreats: TrendDataPoint[];
    openThreats: TrendDataPoint[];
  };
  topRisks: TopRiskItem[];
  modelSummaries: ModelSummary[];
  complianceOverview: Array<{
    framework: string;
    score: number;
    gaps: number;
  }>;
  programHealth: {
    meanTimeToMitigate: number;
    mitigationVelocity: number;
    threatDiscoveryRate: number;
    reviewRate: number;
  };
}

async function fetchPortfolioDashboard(
  orgId: string,
  period: string,
): Promise<OrganizationDashboard> {
  return apiGet<OrganizationDashboard>(
    `/api/reporting/organization/${orgId}?period=${period}`,
  );
}

export function usePortfolioDashboard(orgId: string | null, period = "30d") {
  return useQuery({
    queryKey: ["portfolio-dashboard", orgId, period],
    queryFn: () => fetchPortfolioDashboard(orgId!, period),
    enabled: !!orgId,
    staleTime: 60_000,
  });
}
